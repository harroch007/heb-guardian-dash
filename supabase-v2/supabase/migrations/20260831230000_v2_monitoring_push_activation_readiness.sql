begin;

-- Dormant deployment and operational enablement are separate boundaries. The
-- original cutoff is retained for audit, while activation_cutoff remains the
-- effective claim-time boundary after the owner explicitly prepares rollout.
alter table public.v2_monitoring_push_activation_epochs
    add column dormant_deployment_cutoff timestamptz,
    add column enablement_prepared_at timestamptz;

update public.v2_monitoring_push_activation_epochs epoch
   set dormant_deployment_cutoff = epoch.activation_cutoff
 where epoch.dormant_deployment_cutoff is null;

alter table public.v2_monitoring_push_activation_epochs
    add constraint v2_monitoring_push_two_phase_cutoff_shape
        check (
            (
                enablement_prepared_at is null
                and (
                    dormant_deployment_cutoff is null
                    or activation_cutoff = dormant_deployment_cutoff
                )
            )
            or (
                enablement_prepared_at is not null
                and dormant_deployment_cutoff is not null
                and activation_cutoff >= dormant_deployment_cutoff
                and enablement_prepared_at >= activation_cutoff
            )
        );

comment on column
    public.v2_monitoring_push_activation_epochs.dormant_deployment_cutoff is
    'Immutable evidence cutoff recorded by dormant deployment before any monitoring push activation.';
comment on column
    public.v2_monitoring_push_activation_epochs.enablement_prepared_at is
    'Owner-only one-time activation preparation timestamp. Null keeps capability validation fail-closed.';

-- A valid token alone must never activate the lane. The owner-only preparation
-- gate has to advance the effective cutoff first.
create or replace function public.v2_monitoring_push_capability_is_valid(
    target_capability_token text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    supplied_hash bytea;
    stored_hash bytea;
    matched_count integer := 0;
begin
    if target_capability_token is null
       or char_length(target_capability_token) not between 32 and 256 then
        return false;
    end if;

    if not exists (
        select 1
          from public.v2_monitoring_push_activation_epochs epoch
         where epoch.singleton
           and epoch.enablement_prepared_at is not null
           and epoch.dormant_deployment_cutoff is not null
           and epoch.activation_cutoff >= epoch.dormant_deployment_cutoff
    ) then
        return false;
    end if;

    supplied_hash := extensions.digest(
        convert_to(target_capability_token, 'UTF8'),
        'sha256'
    );

    for stored_hash in
        select capability.token_hash
          from public.v2_monitoring_push_worker_capabilities capability
         where capability.status = 'active'
           and capability.expires_at > now()
    loop
        matched_count := matched_count + case
            when public.v2_constant_time_digest_equal_internal(
                supplied_hash,
                stored_hash
            ) then 1
            else 0
        end;
    end loop;

    return matched_count > 0;
end;
$$;

-- This is the only operation allowed to bridge dormant deployment and a later
-- controlled activation. It advances the effective claim cutoff exactly once,
-- retains every row, and suppresses all committed gap backlog atomically.
create or replace function public.v2_prepare_monitoring_push_activation_internal()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    epoch public.v2_monitoring_push_activation_epochs%rowtype;
    enablement_cutoff timestamptz;
    total_pending_count bigint;
    pre_enablement_count bigint;
    revoked_device_count bigint;
    expired_count bigint;
    suppression_candidate_count bigint;
    suppressed_count bigint;
    remaining_pending_count bigint;
    audit_metadata jsonb;
begin
    lock table public.v2_monitoring_alert_deliveries
        in share row exclusive mode;

    select current_epoch.*
      into epoch
      from public.v2_monitoring_push_activation_epochs current_epoch
     where current_epoch.singleton
     for update;

    if epoch.singleton is null then
        raise exception 'monitoring_activation_epoch_missing'
            using errcode = '55000';
    end if;
    if epoch.enablement_prepared_at is not null then
        raise exception 'monitoring_activation_already_prepared'
            using errcode = '55000';
    end if;
    -- Capture the actual boundary only after the table and singleton row are
    -- locked. transaction_timestamp() could predate a long lock wait and let
    -- dormant-gap rows appear newer than the approved cutoff.
    enablement_cutoff := clock_timestamp();
    if enablement_cutoff < coalesce(
        epoch.dormant_deployment_cutoff,
        epoch.activation_cutoff
    ) then
        raise exception 'monitoring_enablement_cutoff_precedes_dormant_deployment'
            using errcode = '22023';
    end if;
    if exists (
        select 1
          from public.v2_monitoring_alert_deliveries delivery
         where delivery.lease_expires_at > enablement_cutoff
    ) then
        raise exception 'monitoring_activation_has_active_leases'
            using errcode = '55000';
    end if;

    select
        count(*)::bigint,
        count(*) filter (
            where delivery.created_at < enablement_cutoff
        )::bigint,
        count(*) filter (
            where device.status = 'revoked'
        )::bigint,
        count(*) filter (
            where delivery.expires_at <= enablement_cutoff
        )::bigint,
        count(*) filter (
            where delivery.created_at < enablement_cutoff
               or device.status = 'revoked'
               or delivery.expires_at <= enablement_cutoff
        )::bigint
      into
        total_pending_count,
        pre_enablement_count,
        revoked_device_count,
        expired_count,
        suppression_candidate_count
      from public.v2_monitoring_alert_deliveries delivery
      join public.v2_device_monitoring_transitions transition
        on transition.id = delivery.transition_id
      join public.v2_protected_devices device
        on device.id = transition.device_id
     where delivery.status in ('queued', 'failed');

    update public.v2_monitoring_alert_deliveries delivery
       set status = 'suppressed',
           failure_code = case
               when device.status = 'revoked'
                   then 'device_revoked'
               when delivery.created_at < enablement_cutoff
                   then 'pre_enablement_cutoff'
               else 'delivery_expired'
           end,
           next_attempt_at = null,
           lease_owner = null,
           lease_token_hash = null,
           lease_expires_at = null,
           suppressed_at = enablement_cutoff,
           suppression_reason = case
               when device.status = 'revoked'
                   then 'device_revoked'
               when delivery.created_at < enablement_cutoff
                   then 'pre_enablement_cutoff'
               else 'delivery_expired'
           end
      from public.v2_device_monitoring_transitions transition,
           public.v2_protected_devices device
     where delivery.status in ('queued', 'failed')
       and transition.id = delivery.transition_id
       and device.id = transition.device_id
       and (
            delivery.created_at < enablement_cutoff
            or device.status = 'revoked'
            or delivery.expires_at <= enablement_cutoff
       );

    get diagnostics suppressed_count = row_count;

    if suppressed_count <> suppression_candidate_count then
        raise exception 'monitoring_enablement_suppression_count_mismatch'
            using errcode = '55000';
    end if;

    update public.v2_monitoring_push_activation_epochs current_epoch
       set dormant_deployment_cutoff = coalesce(
               current_epoch.dormant_deployment_cutoff,
               current_epoch.activation_cutoff
           ),
           activation_cutoff = enablement_cutoff,
           enablement_prepared_at = clock_timestamp()
     where current_epoch.singleton;

    select count(*)::bigint
      into remaining_pending_count
      from public.v2_monitoring_alert_deliveries delivery
     where delivery.status in ('queued', 'failed');

    audit_metadata := jsonb_build_object(
        'dormant_deployment_cutoff', coalesce(
            epoch.dormant_deployment_cutoff,
            epoch.activation_cutoff
        ),
        'enablement_cutoff', enablement_cutoff,
        'total_pending_before', total_pending_count,
        'pre_enablement_count', pre_enablement_count,
        'revoked_device_count', revoked_device_count,
        'expired_count', expired_count,
        'suppression_candidate_count', suppression_candidate_count,
        'suppressed_count', suppressed_count,
        'remaining_pending_after', remaining_pending_count,
        'reason_precedence', jsonb_build_array(
            'device_revoked',
            'pre_enablement_cutoff',
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
        'v2.monitoring.push_activation.prepare',
        'monitoring_push_activation',
        'success',
        audit_metadata
    );

    return audit_metadata;
end;
$$;

-- Kept separate from HTTP dispatch so the bounded-work contract is directly
-- testable without creating an external request.
create or replace function public.v2_monitoring_push_due_dispatch_count_internal(
    target_max_requests integer default 4
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    dispatch_count integer;
begin
    if target_max_requests is null
       or target_max_requests not between 1 and 8 then
        raise exception 'invalid_monitoring_push_dispatch_batch'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
          from public.v2_monitoring_push_activation_epochs epoch
         where epoch.singleton
           and epoch.enablement_prepared_at is not null
    ) then
        return 0;
    end if;

    select least(target_max_requests, count(*))::integer
      into dispatch_count
      from public.v2_monitoring_alert_deliveries delivery
     where delivery.status in ('queued', 'failed')
       and delivery.next_attempt_at is not null
       and delivery.next_attempt_at <= now()
       and delivery.attempt_count < 5
       and (
            delivery.lease_owner is null
            or delivery.lease_expires_at <= now()
       );

    return coalesce(dispatch_count, 0);
end;
$$;

-- Owner-only and intentionally unscheduled. Vault contains only the public
-- HTTP trigger credential; the database capability and VAPID private key stay
-- outside PostgreSQL.
create or replace function public.v2_dispatch_monitoring_push_worker_internal(
    target_max_requests integer default 4
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    worker_endpoint text;
    worker_trigger_token text;
    dispatch_count integer;
    dispatch_index integer;
begin
    if target_max_requests is null
       or target_max_requests not between 1 and 8 then
        raise exception 'invalid_monitoring_push_dispatch_batch'
            using errcode = '22023';
    end if;

    dispatch_count :=
        public.v2_monitoring_push_due_dispatch_count_internal(
            target_max_requests
        );
    if dispatch_count = 0 then
        return 0;
    end if;

    select secret.decrypted_secret
      into worker_endpoint
      from vault.decrypted_secrets secret
     where secret.name = 'kippy_v2_monitoring_push_worker_endpoint'
     order by secret.created_at desc
     limit 1;

    select secret.decrypted_secret
      into worker_trigger_token
      from vault.decrypted_secrets secret
     where secret.name = 'kippy_v2_monitoring_push_worker_trigger_token'
     order by secret.created_at desc
     limit 1;

    if worker_endpoint is null
       or worker_endpoint !~
            '^https://[A-Za-z0-9.-]+/functions/v1/v2-deliver-monitoring-push$'
       or worker_trigger_token is null
       or char_length(worker_trigger_token) not between 32 and 256 then
        return 0;
    end if;

    for dispatch_index in 1..dispatch_count loop
        perform net.http_post(
            url := worker_endpoint,
            headers := jsonb_build_object(
                'Content-Type',
                'application/json',
                'x-kippy-monitoring-push-token',
                worker_trigger_token
            ),
            body := jsonb_build_object(
                'source',
                'pg_cron',
                'dispatch_sequence',
                dispatch_index
            ),
            timeout_milliseconds := 25000
        );
    end loop;

    return dispatch_count;
end;
$$;

revoke all on function
    public.v2_monitoring_push_capability_is_valid(text),
    public.v2_prepare_monitoring_push_activation_internal(),
    public.v2_monitoring_push_due_dispatch_count_internal(integer),
    public.v2_dispatch_monitoring_push_worker_internal(integer)
from public, anon, authenticated, service_role;

comment on table public.v2_monitoring_push_activation_epochs is
    'Two-phase monitoring push cutoff. Dormant deployment is retained separately; capability validation remains closed until owner-only enablement preparation.';
comment on function
    public.v2_prepare_monitoring_push_activation_internal() is
    'Owner-only one-time gap-backlog suppression and effective cutoff advancement. It does not configure credentials, cron, endpoints, or feature flags.';
comment on function
    public.v2_monitoring_push_due_dispatch_count_internal(integer) is
    'Owner-only bounded due-work counter. Returns zero until activation preparation is complete.';
comment on function
    public.v2_dispatch_monitoring_push_worker_internal(integer) is
    'Owner-only, unscheduled, fail-closed dispatcher for the dedicated monitoring worker. Reads exactly two monitoring Vault names.';

commit;
