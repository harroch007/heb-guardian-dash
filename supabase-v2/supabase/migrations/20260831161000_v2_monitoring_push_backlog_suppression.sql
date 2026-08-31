begin;

-- The cutoff is the execution-time boundary of this activation migration. No
-- review-time queue count or calendar timestamp is embedded in source.
create or replace function public.v2_suppress_monitoring_delivery_backlog_internal(
    target_cutoff timestamptz default transaction_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    recorded_cutoff timestamptz;
    total_queued_count bigint;
    pre_cutoff_count bigint;
    older_than_seven_days_count bigint;
    revoked_device_count bigint;
    revoked_pre_cutoff_overlap_count bigint;
    expired_count bigint;
    suppression_candidate_count bigint;
    remaining_eligible_count bigint;
    remaining_queued_count bigint;
    suppressed_count bigint;
    audit_metadata jsonb;
begin
    if target_cutoff is null
       or target_cutoff > transaction_timestamp() + interval '1 second' then
        raise exception 'invalid_monitoring_activation_cutoff'
            using errcode = '22023';
    end if;

    -- Keep the before/update/after counts in one stable write boundary. This is
    -- a short activation migration, not a recurring worker operation.
    lock table public.v2_monitoring_alert_deliveries
        in share row exclusive mode;

    insert into public.v2_monitoring_push_activation_epochs (
        singleton,
        activation_cutoff
    )
    values (true, target_cutoff)
    on conflict (singleton) do nothing;

    select epoch.activation_cutoff
      into recorded_cutoff
      from public.v2_monitoring_push_activation_epochs epoch
     where epoch.singleton
     for update;

    if recorded_cutoff is distinct from target_cutoff then
        raise exception 'monitoring_activation_cutoff_is_immutable'
            using errcode = '55000';
    end if;

    select
        count(*)::bigint,
        count(*) filter (
            where delivery.created_at < target_cutoff
        )::bigint,
        count(*) filter (
            where delivery.created_at <
                target_cutoff - interval '7 days'
        )::bigint,
        count(*) filter (
            where device.status = 'revoked'
        )::bigint,
        count(*) filter (
            where device.status = 'revoked'
              and delivery.created_at < target_cutoff
        )::bigint,
        count(*) filter (
            where delivery.expires_at <= target_cutoff
        )::bigint,
        count(*) filter (
            where delivery.created_at < target_cutoff
               or device.status = 'revoked'
               or delivery.expires_at <= target_cutoff
        )::bigint,
        count(*) filter (
            where delivery.created_at >= target_cutoff
              and device.status <> 'revoked'
              and delivery.expires_at > target_cutoff
        )::bigint
      into
        total_queued_count,
        pre_cutoff_count,
        older_than_seven_days_count,
        revoked_device_count,
        revoked_pre_cutoff_overlap_count,
        expired_count,
        suppression_candidate_count,
        remaining_eligible_count
      from public.v2_monitoring_alert_deliveries delivery
      join public.v2_device_monitoring_transitions transition
        on transition.id = delivery.transition_id
      join public.v2_protected_devices device
        on device.id = transition.device_id
     where delivery.status = 'queued';

    update public.v2_monitoring_alert_deliveries delivery
       set status = 'suppressed',
           failure_code = case
               when device.status = 'revoked'
                   then 'device_revoked'
               when delivery.created_at < target_cutoff
                   then 'pre_activation_cutoff'
               else 'delivery_expired'
           end,
           next_attempt_at = null,
           lease_owner = null,
           lease_token_hash = null,
           lease_expires_at = null,
           suppressed_at = target_cutoff,
           suppression_reason = case
               when device.status = 'revoked'
                   then 'device_revoked'
               when delivery.created_at < target_cutoff
                   then 'pre_activation_cutoff'
               else 'delivery_expired'
           end
      from public.v2_device_monitoring_transitions transition,
           public.v2_protected_devices device
     where delivery.status = 'queued'
       and transition.id = delivery.transition_id
       and device.id = transition.device_id
       and (
            delivery.created_at < target_cutoff
            or device.status = 'revoked'
            or delivery.expires_at <= target_cutoff
       );

    get diagnostics suppressed_count = row_count;

    select count(*)::bigint
      into remaining_queued_count
      from public.v2_monitoring_alert_deliveries delivery
     where delivery.status = 'queued';

    if suppressed_count <> suppression_candidate_count then
        raise exception 'monitoring_backlog_suppression_count_mismatch'
            using errcode = '55000';
    end if;

    audit_metadata := jsonb_build_object(
        'activation_cutoff', target_cutoff,
        'total_queued_before', total_queued_count,
        'pre_cutoff_count', pre_cutoff_count,
        'older_than_seven_days_count', older_than_seven_days_count,
        'revoked_device_count', revoked_device_count,
        'revoked_pre_cutoff_overlap_count',
            revoked_pre_cutoff_overlap_count,
        'expired_count', expired_count,
        'suppression_candidate_count', suppression_candidate_count,
        'suppressed_count', suppressed_count,
        'remaining_eligible_before', remaining_eligible_count,
        'remaining_queued_after', remaining_queued_count,
        'reason_precedence', jsonb_build_array(
            'device_revoked',
            'pre_activation_cutoff',
            'delivery_expired'
        )
    );

    insert into public.v2_audit_events (
        actor_type,
        action,
        object_type,
        outcome,
        metadata
    )
    values (
        'system',
        'v2.monitoring.push_backlog.suppress',
        'monitoring_delivery_backlog',
        'success',
        audit_metadata
    );

    return audit_metadata;
end;
$$;

revoke all on function
    public.v2_suppress_monitoring_delivery_backlog_internal(timestamptz)
from public, anon, authenticated, service_role;

-- Runtime evaluation is intentional: when this forward-only migration is
-- eventually approved for a target, that target's transaction timestamp is
-- its activation-era cutoff. Rows are retained and only marked suppressed.
select public.v2_suppress_monitoring_delivery_backlog_internal(
    transaction_timestamp()
);

comment on function
    public.v2_suppress_monitoring_delivery_backlog_internal(timestamptz) is
    'Owner-only, immutable-cutoff backlog suppression with actual runtime counts and a v2_audit_events aggregate. It never deletes delivery rows.';

commit;
