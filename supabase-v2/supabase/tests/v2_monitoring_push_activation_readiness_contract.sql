-- Disposable synthetic database contract only. Every fixture is rolled back.
begin;

do $$
begin
    if exists (
        select 1
          from public.v2_monitoring_alert_deliveries delivery
         where delivery.status in ('queued', 'failed')
    ) then
        raise exception 'activation_readiness_contract_requires_clean_queue';
    end if;
    if not exists (
        select 1
          from public.v2_monitoring_push_activation_epochs epoch
         where epoch.singleton
           and epoch.dormant_deployment_cutoff is not null
           and epoch.enablement_prepared_at is null
           and epoch.activation_cutoff = epoch.dormant_deployment_cutoff
    ) then
        raise exception 'monitoring_enablement_gate_not_dormant';
    end if;
end;
$$;

insert into auth.users (id)
values ('31000000-0000-4000-8000-000000000001');

insert into public.v2_families (id, display_name, status)
values (
    '32000000-0000-4000-8000-000000000001',
    'Synthetic monitoring activation family',
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
    '32100000-0000-4000-8000-000000000001',
    '32000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001',
    'owner',
    'active'
);

insert into public.v2_children (id, family_id, display_name, status)
values (
    '32200000-0000-4000-8000-000000000001',
    '32000000-0000-4000-8000-000000000001',
    'Synthetic monitoring activation child',
    'active'
);

insert into public.v2_protected_devices (
    id,
    child_id,
    installation_id,
    app_version,
    status
)
values (
    '32300000-0000-4000-8000-000000000001',
    '32200000-0000-4000-8000-000000000001',
    '32400000-0000-4000-8000-000000000001',
    'synthetic-activation-readiness-contract',
    'active'
);

insert into public.v2_monitoring_push_worker_capabilities (
    token_hash,
    label,
    expires_at
)
values (
    extensions.digest(
        convert_to(
            'monitoring-activation-contract-capability-000001',
            'UTF8'
        ),
        'sha256'
    ),
    'Disposable monitoring activation readiness contract',
    transaction_timestamp() + interval '1 hour'
);

-- A valid capability cannot bypass the separate enablement-preparation gate.
do $$
begin
    if public.v2_monitoring_push_capability_is_valid(
        'monitoring-activation-contract-capability-000001'
    ) then
        raise exception 'capability_bypassed_unprepared_enablement_gate';
    end if;

    begin
        perform public.v2_claim_monitoring_delivery_service(
            'monitoring-activation-contract-capability-000001',
            '33000000-0000-4000-8000-000000000001',
            120
        );
        raise exception 'claim_did_not_fail_closed_before_preparation';
    exception
        when insufficient_privilege then
            if sqlerrm <> 'invalid_monitoring_push_worker_capability' then
                raise;
            end if;
    end;
end;
$$;

-- These two rows represent committed work created after dormant deployment but
-- before an explicitly approved activation cutoff.
insert into public.v2_device_monitoring_transitions (
    id,
    device_id,
    episode_id,
    previous_state,
    new_state,
    reason_codes,
    source,
    state_version,
    occurred_at,
    created_at
)
select
    (
        '32800000-0000-4000-8000-' ||
        lpad(sequence_no::text, 12, '0')
    )::uuid,
    '32300000-0000-4000-8000-000000000001'::uuid,
    '32700000-0000-4000-8000-000000000001'::uuid,
    'protected',
    'interrupted',
    array['synthetic'],
    'system',
    sequence_no,
    epoch.dormant_deployment_cutoff +
        ((transaction_timestamp() - epoch.dormant_deployment_cutoff) / 2),
    epoch.dormant_deployment_cutoff +
        ((transaction_timestamp() - epoch.dormant_deployment_cutoff) / 2)
  from generate_series(1, 2) sequence_no
 cross join public.v2_monitoring_push_activation_epochs epoch
 where epoch.singleton;

insert into public.v2_monitoring_alert_deliveries (
    id,
    transition_id,
    guardian_user_id,
    alert_type,
    severity,
    status,
    idempotency_key,
    failure_code,
    attempt_count,
    next_attempt_at,
    expires_at,
    created_at
)
select
    (
        '32900000-0000-4000-8000-' ||
        lpad(sequence_no::text, 12, '0')
    )::uuid,
    (
        '32800000-0000-4000-8000-' ||
        lpad(sequence_no::text, 12, '0')
    )::uuid,
    '31000000-0000-4000-8000-000000000001'::uuid,
    'monitoring_interrupted',
    'critical',
    case when sequence_no = 1 then 'queued' else 'failed' end,
    'activation-gap-' || sequence_no,
    case when sequence_no = 1 then null else 'synthetic_retry' end,
    case when sequence_no = 1 then 0 else 1 end,
    transaction_timestamp() - interval '1 second',
    transaction_timestamp() + interval '6 hours',
    transition.created_at
  from generate_series(1, 2) sequence_no
  join public.v2_device_monitoring_transitions transition
    on transition.id = (
        '32800000-0000-4000-8000-' ||
        lpad(sequence_no::text, 12, '0')
    )::uuid;

do $$
declare
    preparation jsonb;
begin
    preparation := public.v2_prepare_monitoring_push_activation_internal();

    if (preparation->>'total_pending_before')::bigint <> 2
       or (preparation->>'pre_enablement_count')::bigint <> 2
       or (preparation->>'suppression_candidate_count')::bigint <> 2
       or (preparation->>'suppressed_count')::bigint <> 2
       or (preparation->>'remaining_pending_after')::bigint <> 0 then
        raise exception 'activation_gap_suppression_counts_failed:%',
            preparation;
    end if;
    if (select count(*)
          from public.v2_monitoring_alert_deliveries delivery
         where delivery.id in (
            '32900000-0000-4000-8000-000000000001',
            '32900000-0000-4000-8000-000000000002'
         )
           and delivery.status = 'suppressed'
           and delivery.suppression_reason = 'pre_enablement_cutoff'
           and delivery.failure_code = 'pre_enablement_cutoff'
           and delivery.next_attempt_at is null) <> 2 then
        raise exception 'activation_gap_rows_not_suppressed';
    end if;
    if not public.v2_monitoring_push_capability_is_valid(
        'monitoring-activation-contract-capability-000001'
    ) then
        raise exception 'prepared_enablement_gate_rejected_valid_capability';
    end if;
    if not exists (
        select 1
          from public.v2_monitoring_push_activation_epochs epoch
         where epoch.singleton
           and epoch.enablement_prepared_at is not null
           and epoch.activation_cutoff > transaction_timestamp()
           and epoch.enablement_prepared_at >= epoch.activation_cutoff
           and epoch.dormant_deployment_cutoff < epoch.activation_cutoff
    ) then
        raise exception 'activation_cutoff_was_not_advanced';
    end if;

    begin
        perform public.v2_prepare_monitoring_push_activation_internal();
        raise exception 'activation_preparation_was_not_one_time';
    exception
        when object_not_in_prerequisite_state then
            if sqlerrm <> 'monitoring_activation_already_prepared' then
                raise;
            end if;
    end;
end;
$$;

-- Ten fresh due rows make the 1..8 dispatcher bound observable without
-- calling the delivery worker itself.
insert into public.v2_device_monitoring_transitions (
    id,
    device_id,
    episode_id,
    previous_state,
    new_state,
    reason_codes,
    source,
    state_version,
    occurred_at,
    created_at
)
select
    (
        '33800000-0000-4000-8000-' ||
        lpad(sequence_no::text, 12, '0')
    )::uuid,
    '32300000-0000-4000-8000-000000000001'::uuid,
    (
        '33700000-0000-4000-8000-' ||
        lpad(sequence_no::text, 12, '0')
    )::uuid,
    'protected',
    'interrupted',
    array['synthetic'],
    'system',
    sequence_no + 2,
    epoch.activation_cutoff + interval '1 millisecond',
    epoch.activation_cutoff + interval '1 millisecond'
  from generate_series(1, 10) sequence_no
 cross join public.v2_monitoring_push_activation_epochs epoch
 where epoch.singleton;

insert into public.v2_monitoring_alert_deliveries (
    id,
    transition_id,
    guardian_user_id,
    alert_type,
    severity,
    idempotency_key,
    next_attempt_at,
    expires_at,
    created_at
)
select
    (
        '33900000-0000-4000-8000-' ||
        lpad(sequence_no::text, 12, '0')
    )::uuid,
    (
        '33800000-0000-4000-8000-' ||
        lpad(sequence_no::text, 12, '0')
    )::uuid,
    '31000000-0000-4000-8000-000000000001'::uuid,
    'monitoring_interrupted',
    'critical',
    'activation-fresh-' || sequence_no,
    transaction_timestamp() - interval '1 second',
    epoch.activation_cutoff + interval '6 hours',
    epoch.activation_cutoff + interval '1 millisecond'
  from generate_series(1, 10) sequence_no
 cross join public.v2_monitoring_push_activation_epochs epoch
 where epoch.singleton;

do $$
begin
    if public.v2_monitoring_push_due_dispatch_count_internal(4) <> 4
       or public.v2_monitoring_push_due_dispatch_count_internal(8) <> 8 then
        raise exception 'bounded_dispatch_count_failed';
    end if;

    begin
        perform public.v2_monitoring_push_due_dispatch_count_internal(0);
        raise exception 'zero_dispatch_bound_was_accepted';
    exception
        when invalid_parameter_value then null;
    end;
    begin
        perform public.v2_dispatch_monitoring_push_worker_internal(9);
        raise exception 'oversized_dispatch_bound_was_accepted';
    exception
        when invalid_parameter_value then null;
    end;
end;
$$;

-- Missing exact monitoring Vault values is a no-op and cannot enqueue HTTP.
delete from vault.secrets secret
 where secret.name in (
    'kippy_v2_monitoring_push_worker_endpoint',
    'kippy_v2_monitoring_push_worker_trigger_token'
 );

do $$
declare
    request_count_before bigint;
    request_count_after bigint;
begin
    select count(*) into request_count_before
      from net.http_request_queue request;

    if public.v2_dispatch_monitoring_push_worker_internal(4) <> 0 then
        raise exception 'dispatcher_did_not_fail_closed_without_vault';
    end if;

    select count(*) into request_count_after
      from net.http_request_queue request;
    if request_count_after <> request_count_before then
        raise exception 'missing_vault_configuration_enqueued_http';
    end if;
end;
$$;

select vault.create_secret(
    'https://example.invalid/functions/v1/v2-deliver-monitoring-push',
    'kippy_v2_monitoring_push_worker_endpoint',
    'Disposable activation-readiness contract endpoint'
);
select vault.create_secret(
    repeat('T', 64),
    'kippy_v2_monitoring_push_worker_trigger_token',
    'Disposable activation-readiness contract token'
);

do $$
declare
    matching_requests_before bigint;
    matching_requests_after bigint;
begin
    select count(*) into matching_requests_before
      from net.http_request_queue request
     where request.url =
        'https://example.invalid/functions/v1/v2-deliver-monitoring-push';

    if public.v2_dispatch_monitoring_push_worker_internal(4) <> 4 then
        raise exception 'dispatcher_did_not_honor_bound';
    end if;

    select count(*) into matching_requests_after
      from net.http_request_queue request
     where request.url =
        'https://example.invalid/functions/v1/v2-deliver-monitoring-push';
    if matching_requests_after - matching_requests_before <> 4 then
        raise exception 'dispatcher_http_request_bound_failed';
    end if;
end;
$$;

-- The dispatcher and both activation helpers are owner-only. In particular,
-- service_role cannot invoke orchestration even though it can claim work.
do $$
declare
    function_signature regprocedure;
    function_definition text;
    configured_vault_names text[];
begin
    foreach function_signature in array array[
        'public.v2_prepare_monitoring_push_activation_internal()'::regprocedure,
        'public.v2_monitoring_push_due_dispatch_count_internal(integer)'::regprocedure,
        'public.v2_dispatch_monitoring_push_worker_internal(integer)'::regprocedure
    ] loop
        if has_function_privilege(
            'anon', function_signature, 'EXECUTE'
        ) or has_function_privilege(
            'authenticated', function_signature, 'EXECUTE'
        ) or has_function_privilege(
            'service_role', function_signature, 'EXECUTE'
        ) or exists (
            select 1
              from pg_proc procedure
              cross join lateral aclexplode(
                  coalesce(
                      procedure.proacl,
                      acldefault('f', procedure.proowner)
                  )
              ) privilege
             where procedure.oid = function_signature
               and privilege.grantee = 0
               and privilege.privilege_type = 'EXECUTE'
        ) then
            raise exception 'owner_only_dispatch_acl_failed:%',
                function_signature;
        end if;
    end loop;

    select pg_get_functiondef(
        'public.v2_dispatch_monitoring_push_worker_internal(integer)'::regprocedure
    ) into function_definition;
    select array_agg(match[1] order by match[1])
      into configured_vault_names
      from regexp_matches(
          function_definition,
          $pattern$secret[.]name[[:space:]]*=[[:space:]]*'([^']+)'$pattern$,
          'g'
      ) match;
    if configured_vault_names is distinct from array[
        'kippy_v2_monitoring_push_worker_endpoint',
        'kippy_v2_monitoring_push_worker_trigger_token'
    ]::text[] then
        raise exception 'dispatcher_vault_allowlist_failed:%',
            configured_vault_names;
    end if;

    if exists (
        select 1
          from cron.job job
         where job.jobname = 'kippy-v2-monitoring-push'
            or job.command like
                '%v2_dispatch_monitoring_push_worker_internal%'
    ) then
        raise exception 'monitoring_dispatch_cron_was_activated';
    end if;
end;
$$;

select 'V2 monitoring push activation readiness contract: PASS';

rollback;
