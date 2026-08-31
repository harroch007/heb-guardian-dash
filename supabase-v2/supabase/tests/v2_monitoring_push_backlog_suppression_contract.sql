-- Disposable synthetic database contract only. Every fixture is rolled back.
begin;

do $$
begin
    if exists (
        select 1
          from public.v2_monitoring_alert_deliveries delivery
         where delivery.status = 'queued'
    ) then
        raise exception 'suppression_contract_requires_clean_disposable_queue';
    end if;
end;
$$;

select set_config(
    'test.monitoring_cutoff',
    (statement_timestamp() - interval '1 hour')::text,
    true
);

insert into auth.users (id)
values ('11000000-0000-4000-8000-000000000001');

insert into public.v2_families (id, display_name, status)
values (
    '12000000-0000-4000-8000-000000000001',
    'Synthetic monitoring suppression family',
    'active'
);

insert into public.v2_guardian_memberships (
    id,
    family_id,
    guardian_user_id,
    role,
    status
)
values (
    '13000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'owner',
    'active'
);

insert into public.v2_children (id, family_id, display_name, status)
values (
    '14000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001',
    'Synthetic monitoring suppression child',
    'active'
);

insert into public.v2_protected_devices (
    id,
    child_id,
    installation_id,
    app_version,
    status
)
values
    (
        '15000000-0000-4000-8000-000000000001',
        '14000000-0000-4000-8000-000000000001',
        '16000000-0000-4000-8000-000000000001',
        'synthetic-suppression',
        'active'
    ),
    (
        '15000000-0000-4000-8000-000000000002',
        '14000000-0000-4000-8000-000000000001',
        '16000000-0000-4000-8000-000000000002',
        'synthetic-suppression',
        'revoked'
    );

insert into public.v2_device_monitoring_transitions (
    id,
    device_id,
    episode_id,
    previous_state,
    new_state,
    reason_codes,
    source,
    state_version,
    occurred_at
)
values
    (
        '17000000-0000-4000-8000-000000000001',
        '15000000-0000-4000-8000-000000000001',
        '18000000-0000-4000-8000-000000000001',
        'protected',
        'interrupted',
        array['synthetic'],
        'system',
        1,
        current_setting('test.monitoring_cutoff')::timestamptz - interval '10 days'
    ),
    (
        '17000000-0000-4000-8000-000000000002',
        '15000000-0000-4000-8000-000000000002',
        '18000000-0000-4000-8000-000000000002',
        'protected',
        'interrupted',
        array['synthetic'],
        'system',
        1,
        current_setting('test.monitoring_cutoff')::timestamptz + interval '30 minutes'
    ),
    (
        '17000000-0000-4000-8000-000000000003',
        '15000000-0000-4000-8000-000000000002',
        '18000000-0000-4000-8000-000000000003',
        'interrupted',
        'interrupted',
        array['synthetic'],
        'system',
        2,
        current_setting('test.monitoring_cutoff')::timestamptz - interval '9 days'
    ),
    (
        '17000000-0000-4000-8000-000000000004',
        '15000000-0000-4000-8000-000000000001',
        '18000000-0000-4000-8000-000000000004',
        'protected',
        'heartbeat_late',
        array['synthetic'],
        'system',
        2,
        current_setting('test.monitoring_cutoff')::timestamptz
    ),
    (
        '17000000-0000-4000-8000-000000000005',
        '15000000-0000-4000-8000-000000000001',
        '18000000-0000-4000-8000-000000000005',
        'interrupted',
        'interrupted',
        array['synthetic'],
        'system',
        3,
        current_setting('test.monitoring_cutoff')::timestamptz + interval '30 minutes'
    );

insert into public.v2_monitoring_alert_deliveries (
    id,
    transition_id,
    guardian_user_id,
    alert_type,
    severity,
    idempotency_key,
    status,
    created_at,
    next_attempt_at,
    expires_at
)
values
    (
        '19000000-0000-4000-8000-000000000001',
        '17000000-0000-4000-8000-000000000001',
        '11000000-0000-4000-8000-000000000001',
        'monitoring_interrupted',
        'critical',
        'suppression-old-active',
        'queued',
        current_setting('test.monitoring_cutoff')::timestamptz - interval '10 days',
        statement_timestamp(),
        current_setting('test.monitoring_cutoff')::timestamptz + interval '1 day'
    ),
    (
        '19000000-0000-4000-8000-000000000002',
        '17000000-0000-4000-8000-000000000002',
        '11000000-0000-4000-8000-000000000001',
        'monitoring_interrupted',
        'critical',
        'suppression-recent-revoked',
        'queued',
        current_setting('test.monitoring_cutoff')::timestamptz + interval '30 minutes',
        statement_timestamp(),
        current_setting('test.monitoring_cutoff')::timestamptz + interval '2 hours'
    ),
    (
        '19000000-0000-4000-8000-000000000003',
        '17000000-0000-4000-8000-000000000003',
        '11000000-0000-4000-8000-000000000001',
        'monitoring_interrupted',
        'critical',
        'suppression-old-revoked-overlap',
        'queued',
        current_setting('test.monitoring_cutoff')::timestamptz - interval '9 days',
        statement_timestamp(),
        current_setting('test.monitoring_cutoff')::timestamptz + interval '1 day'
    ),
    (
        '19000000-0000-4000-8000-000000000004',
        '17000000-0000-4000-8000-000000000004',
        '11000000-0000-4000-8000-000000000001',
        'monitoring_late',
        'warning',
        'suppression-recent-expired',
        'queued',
        current_setting('test.monitoring_cutoff')::timestamptz,
        statement_timestamp(),
        current_setting('test.monitoring_cutoff')::timestamptz
    ),
    (
        '19000000-0000-4000-8000-000000000005',
        '17000000-0000-4000-8000-000000000005',
        '11000000-0000-4000-8000-000000000001',
        'monitoring_interrupted',
        'critical',
        'suppression-recent-eligible',
        'queued',
        current_setting('test.monitoring_cutoff')::timestamptz + interval '30 minutes',
        statement_timestamp(),
        current_setting('test.monitoring_cutoff')::timestamptz + interval '2 hours'
    );

-- Reset only the singleton inside this rolled-back disposable transaction so
-- the owner-only migration helper can be tested with a deterministic cutoff.
delete from public.v2_monitoring_push_activation_epochs;

do $$
declare
    result jsonb;
begin
    result := public.v2_suppress_monitoring_delivery_backlog_internal(
        current_setting('test.monitoring_cutoff')::timestamptz
    );

    if (result->>'total_queued_before')::bigint <> 5
       or (result->>'pre_cutoff_count')::bigint <> 2
       or (result->>'older_than_seven_days_count')::bigint <> 2
       or (result->>'revoked_device_count')::bigint <> 2
       or (result->>'revoked_pre_cutoff_overlap_count')::bigint <> 1
       or (result->>'expired_count')::bigint <> 1
       or (result->>'suppression_candidate_count')::bigint <> 4
       or (result->>'suppressed_count')::bigint <> 4
       or (result->>'remaining_eligible_before')::bigint <> 1
       or (result->>'remaining_queued_after')::bigint <> 1 then
        raise exception 'runtime_backlog_counts_failed:%', result;
    end if;

    if result ? 'review_time_534'
       or result ? 'review_time_505'
       or result ? 'review_time_390' then
        raise exception 'review_time_counts_leaked_into_runtime_contract';
    end if;
end;
$$;

do $$
declare
    retained_count bigint;
    suppressed_count bigint;
    queued_count bigint;
    audited_count bigint;
begin
    select count(*),
           count(*) filter (where delivery.status = 'suppressed'),
           count(*) filter (where delivery.status = 'queued')
      into retained_count, suppressed_count, queued_count
      from public.v2_monitoring_alert_deliveries delivery
     where delivery.id between
        '19000000-0000-4000-8000-000000000001'::uuid
        and '19000000-0000-4000-8000-000000000005'::uuid;

    if retained_count <> 5 or suppressed_count <> 4 or queued_count <> 1 then
        raise exception 'suppression_must_retain_every_row';
    end if;

    if (select suppression_reason
          from public.v2_monitoring_alert_deliveries
         where id = '19000000-0000-4000-8000-000000000001') <>
            'pre_activation_cutoff'
       or (select suppression_reason
             from public.v2_monitoring_alert_deliveries
            where id = '19000000-0000-4000-8000-000000000002') <>
            'device_revoked'
       or (select suppression_reason
             from public.v2_monitoring_alert_deliveries
            where id = '19000000-0000-4000-8000-000000000003') <>
            'device_revoked'
       or (select suppression_reason
             from public.v2_monitoring_alert_deliveries
            where id = '19000000-0000-4000-8000-000000000004') <>
            'delivery_expired'
       or (select status
             from public.v2_monitoring_alert_deliveries
            where id = '19000000-0000-4000-8000-000000000005') <>
            'queued' then
        raise exception 'suppression_reason_precedence_failed';
    end if;

    if exists (
        select 1
          from public.v2_monitoring_alert_deliveries delivery
         where delivery.id between
            '19000000-0000-4000-8000-000000000001'::uuid
            and '19000000-0000-4000-8000-000000000004'::uuid
           and (
                delivery.suppressed_at is distinct from
                    current_setting('test.monitoring_cutoff')::timestamptz
                or delivery.next_attempt_at is not null
                or delivery.lease_owner is not null
                or delivery.lease_token_hash is not null
                or delivery.lease_expires_at is not null
           )
    ) then
        raise exception 'suppressed_row_shape_failed';
    end if;

    select count(*)
      into audited_count
      from public.v2_audit_events event
     where event.action = 'v2.monitoring.push_backlog.suppress'
       and (event.metadata->>'activation_cutoff')::timestamptz =
            current_setting('test.monitoring_cutoff')::timestamptz
       and (event.metadata->>'suppressed_count')::bigint = 4;
    if audited_count <> 1 then
        raise exception 'aggregate_suppression_audit_failed';
    end if;
end;
$$;

do $$
begin
    begin
        perform public.v2_suppress_monitoring_delivery_backlog_internal(
            current_setting('test.monitoring_cutoff')::timestamptz + interval '1 minute'
        );
        raise exception 'activation_cutoff_was_mutable';
    exception
        when sqlstate '55000' then null;
    end;

    if has_function_privilege(
        'service_role',
        'public.v2_suppress_monitoring_delivery_backlog_internal(timestamptz)',
        'EXECUTE'
    ) then
        raise exception 'backlog_suppression_helper_exposed_to_service_role';
    end if;
end;
$$;

select 'V2 monitoring push backlog suppression contract: PASS';

rollback;
