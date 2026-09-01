-- Disposable synthetic database contract only. Every fixture is rolled back.
begin;

do $$
begin
    if not exists (
        select 1
          from public.v2_monitoring_push_circuit_breaker circuit
         where circuit.singleton
           and circuit.circuit_state = 'closed'
           and circuit.consecutive_worker_failures = 0
           and circuit.consecutive_cron_failures = 0
    ) then
        raise exception 'monitoring_push_circuit_default_not_closed';
    end if;
    if exists (
        select 1
          from public.v2_monitoring_alert_deliveries delivery
         where delivery.status in ('queued', 'failed')
    ) then
        raise exception 'circuit_contract_requires_clean_monitoring_queue';
    end if;
end;
$$;

insert into auth.users (id)
values ('41000000-0000-4000-8000-000000000001');

insert into public.v2_families (id, display_name, status)
values (
    '42000000-0000-4000-8000-000000000001',
    'Synthetic monitoring circuit family',
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
    '42100000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001',
    'owner',
    'active'
);

insert into public.v2_children (id, family_id, display_name, status)
values (
    '42200000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    'Synthetic monitoring circuit child',
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
    '42300000-0000-4000-8000-000000000001',
    '42200000-0000-4000-8000-000000000001',
    '42400000-0000-4000-8000-000000000001',
    'synthetic-circuit-contract',
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
            'monitoring-circuit-contract-capability-000001',
            'UTF8'
        ),
        'sha256'
    ),
    'Disposable monitoring circuit contract',
    clock_timestamp() + interval '1 hour'
);

select public.v2_prepare_monitoring_push_activation_internal();

-- Ten due rows model a large device-state event without manufacturing a
-- provider or worker failure. Queue volume alone must never open the circuit.
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
        '42800000-0000-4000-8000-' ||
        lpad(sequence_no::text, 12, '0')
    )::uuid,
    '42300000-0000-4000-8000-000000000001'::uuid,
    (
        '42700000-0000-4000-8000-' ||
        lpad(sequence_no::text, 12, '0')
    )::uuid,
    'protected',
    'interrupted',
    array['synthetic_mass_disconnect'],
    'system',
    sequence_no,
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
        '42900000-0000-4000-8000-' ||
        lpad(sequence_no::text, 12, '0')
    )::uuid,
    (
        '42800000-0000-4000-8000-' ||
        lpad(sequence_no::text, 12, '0')
    )::uuid,
    '41000000-0000-4000-8000-000000000001'::uuid,
    'monitoring_interrupted',
    'critical',
    'circuit-fresh-' || sequence_no,
    transaction_timestamp() - interval '1 second',
    epoch.activation_cutoff + interval '6 hours',
    epoch.activation_cutoff + interval '1 millisecond'
  from generate_series(1, 10) sequence_no
 cross join public.v2_monitoring_push_activation_epochs epoch
 where epoch.singleton;

do $$
declare
    open_function_definition text;
    worker_function_definition text;
    cron_function_definition text;
begin
    perform public.v2_monitoring_push_refresh_circuit_internal();
    if public.v2_monitoring_push_due_dispatch_count_internal(8) <> 8
       or not exists (
            select 1
              from public.v2_monitoring_push_circuit_breaker circuit
             where circuit.singleton
               and circuit.circuit_state = 'closed'
       ) then
        raise exception 'queue_volume_opened_monitoring_push_circuit';
    end if;

    select pg_get_functiondef(
        'public.v2_monitoring_push_open_circuit_internal(text,jsonb)'::regprocedure
    ) into open_function_definition;
    select pg_get_functiondef(
        'public.v2_monitoring_push_apply_worker_signal_internal(boolean,boolean,integer,integer,text)'::regprocedure
    ) into worker_function_definition;
    select pg_get_functiondef(
        'public.v2_monitoring_push_record_cron_result_internal(bigint,boolean)'::regprocedure
    ) into cron_function_definition;

    if concat(
        open_function_definition,
        worker_function_definition,
        cron_function_definition
    ) ~ 'v2_monitoring_alert_deliveries|v2_device_monitoring_transitions' then
        raise exception 'circuit_open_path_depends_on_device_state_volume';
    end if;
end;
$$;

-- Missing Vault configuration is fail-closed and cannot enqueue HTTP.
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
        raise exception 'missing_vault_dispatch_did_not_return_zero';
    end if;

    select count(*) into request_count_after
      from net.http_request_queue request;
    if request_count_after <> request_count_before then
        raise exception 'missing_vault_dispatch_enqueued_http';
    end if;
    if not exists (
        select 1
          from public.v2_monitoring_push_circuit_breaker circuit
         where circuit.singleton
           and circuit.circuit_state = 'closed'
           and circuit.consecutive_worker_failures = 1
    ) then
        raise exception 'missing_vault_dispatch_not_recorded_as_worker_failure';
    end if;
end;
$$;

update public.v2_monitoring_push_circuit_breaker circuit
   set consecutive_worker_failures = 0
 where circuit.singleton;

select vault.create_secret(
    'https://example.invalid/functions/v1/v2-deliver-monitoring-push',
    'kippy_v2_monitoring_push_worker_endpoint',
    'Disposable circuit-breaker contract endpoint'
);
select vault.create_secret(
    repeat('T', 64),
    'kippy_v2_monitoring_push_worker_trigger_token',
    'Disposable circuit-breaker contract token'
);

-- Three consecutive technical worker failures open the circuit. Once open,
-- dispatch is a queue-preserving, audited zero with no HTTP request.
insert into public.v2_monitoring_push_dispatch_runs (
    id,
    source,
    dispatch_sequence,
    is_half_open_probe
)
select
    (
        '43000000-0000-4000-8000-' ||
        lpad(sequence_no::text, 12, '0')
    )::uuid,
    'pg_cron',
    sequence_no,
    false
  from generate_series(1, 3) sequence_no;

select public.v2_report_monitoring_push_worker_run_service(
    'monitoring-circuit-contract-capability-000001',
    '43000000-0000-4000-8000-000000000001',
    false,
    0,
    0,
    'synthetic_worker_failure'
);
select public.v2_report_monitoring_push_worker_run_service(
    'monitoring-circuit-contract-capability-000001',
    '43000000-0000-4000-8000-000000000002',
    false,
    0,
    0,
    'synthetic_worker_failure'
);
select public.v2_report_monitoring_push_worker_run_service(
    'monitoring-circuit-contract-capability-000001',
    '43000000-0000-4000-8000-000000000003',
    false,
    0,
    0,
    'synthetic_worker_failure'
);

do $$
declare
    request_count_before bigint;
    request_count_after bigint;
    queued_count_before bigint;
    queued_count_after bigint;
begin
    if not exists (
        select 1
          from public.v2_monitoring_push_circuit_breaker circuit
         where circuit.singleton
           and circuit.circuit_state = 'open'
           and circuit.open_reason = 'worker_failures'
           and circuit.consecutive_worker_failures = 3
           and circuit.cooldown_until > circuit.opened_at
    ) then
        raise exception 'three_worker_failures_did_not_open_circuit';
    end if;
    if not exists (
        select 1
          from public.v2_audit_events event
         where event.action = 'v2.monitoring.push_circuit.open'
           and event.outcome = 'failed'
           and event.metadata->>'reason' = 'worker_failures'
    ) then
        raise exception 'worker_open_audit_missing';
    end if;

    select count(*) into request_count_before
      from net.http_request_queue request;
    select count(*) into queued_count_before
      from public.v2_monitoring_alert_deliveries delivery
     where delivery.status = 'queued'
       and delivery.lease_owner is null
       and delivery.attempt_count = 0;

    if public.v2_dispatch_monitoring_push_worker_internal(8) <> 0 then
        raise exception 'open_circuit_dispatch_did_not_return_zero';
    end if;

    select count(*) into request_count_after
      from net.http_request_queue request;
    select count(*) into queued_count_after
      from public.v2_monitoring_alert_deliveries delivery
     where delivery.status = 'queued'
       and delivery.lease_owner is null
       and delivery.attempt_count = 0;

    if request_count_after <> request_count_before then
        raise exception 'open_circuit_enqueued_http';
    end if;
    if queued_count_before <> 10 or queued_count_after <> queued_count_before then
        raise exception 'open_circuit_mutated_monitoring_queue';
    end if;
    if not exists (
        select 1
          from public.v2_audit_events event
         where event.action = 'v2.monitoring.push_circuit.block'
           and event.outcome = 'denied'
           and event.metadata->>'state' = 'open'
    ) then
        raise exception 'open_circuit_block_audit_missing';
    end if;
end;
$$;

-- After cooldown, exactly one request is admitted as the half-open probe.
update public.v2_monitoring_push_circuit_breaker circuit
   set opened_at = statement_timestamp() - interval '11 minutes',
       cooldown_until = statement_timestamp() - interval '1 minute'
 where circuit.singleton;

do $$
declare
    request_count_before bigint;
    request_count_after bigint;
    run_count_before bigint;
    run_count_after bigint;
    probe_id uuid;
begin
    select count(*) into request_count_before
      from net.http_request_queue request;
    select count(*) into run_count_before
      from public.v2_monitoring_push_dispatch_runs run;

    if public.v2_dispatch_monitoring_push_worker_internal(8) <> 1 then
        raise exception 'half_open_dispatch_was_not_bounded_to_one';
    end if;

    select count(*) into request_count_after
      from net.http_request_queue request;
    select count(*) into run_count_after
      from public.v2_monitoring_push_dispatch_runs run;
    select run.id into probe_id
      from public.v2_monitoring_push_dispatch_runs run
     where run.status = 'queued'
       and run.is_half_open_probe;

    if request_count_after - request_count_before <> 1
       or run_count_after - run_count_before <> 1
       or probe_id is null
       or not exists (
            select 1
              from public.v2_monitoring_push_circuit_breaker circuit
             where circuit.singleton
               and circuit.circuit_state = 'half_open'
               and circuit.half_open_probe_dispatched_at is not null
       ) then
        raise exception 'half_open_probe_contract_failed';
    end if;

    perform public.v2_report_monitoring_push_worker_run_service(
        'monitoring-circuit-contract-capability-000001',
        probe_id,
        true,
        1,
        0,
        'delivery_provider_accepted'
    );
end;
$$;

do $$
begin
    if not exists (
        select 1
          from public.v2_monitoring_push_circuit_breaker circuit
         where circuit.singleton
           and circuit.circuit_state = 'closed'
           and circuit.open_reason is null
           and circuit.consecutive_worker_failures = 0
    ) or not exists (
        select 1
          from public.v2_audit_events event
         where event.action = 'v2.monitoring.push_circuit.close'
           and event.outcome = 'success'
    ) then
        raise exception 'successful_half_open_probe_did_not_close_circuit';
    end if;
end;
$$;

-- A failed half-open probe reopens the circuit with a fresh cooldown.
select public.v2_monitoring_push_apply_worker_signal_internal(
    false, false, 0, 0, 'synthetic_worker_failure'
);
select public.v2_monitoring_push_apply_worker_signal_internal(
    false, false, 0, 0, 'synthetic_worker_failure'
);
select public.v2_monitoring_push_apply_worker_signal_internal(
    false, false, 0, 0, 'synthetic_worker_failure'
);
update public.v2_monitoring_push_circuit_breaker circuit
   set opened_at = statement_timestamp() - interval '11 minutes',
       cooldown_until = statement_timestamp() - interval '1 minute'
 where circuit.singleton;

do $$
declare
    probe_id uuid;
begin
    if public.v2_dispatch_monitoring_push_worker_internal(8) <> 1 then
        raise exception 'failed_probe_setup_was_not_bounded_to_one';
    end if;
    select run.id into probe_id
      from public.v2_monitoring_push_dispatch_runs run
     where run.status = 'queued'
       and run.is_half_open_probe;
    perform public.v2_report_monitoring_push_worker_run_service(
        'monitoring-circuit-contract-capability-000001',
        probe_id,
        false,
        0,
        0,
        'claim_failed'
    );

    if not exists (
        select 1
          from public.v2_monitoring_push_circuit_breaker circuit
         where circuit.singleton
           and circuit.circuit_state = 'open'
           and circuit.open_reason = 'worker_failures'
           and circuit.cooldown_until > statement_timestamp()
    ) or not exists (
        select 1
          from public.v2_audit_events event
         where event.action = 'v2.monitoring.push_circuit.reopen'
           and event.outcome = 'failed'
    ) then
        raise exception 'failed_half_open_probe_did_not_reopen_circuit';
    end if;
end;
$$;

-- Close once more through the real half-open report path, then isolate the
-- rolling provider sample tests from earlier dispatch evidence.
update public.v2_monitoring_push_circuit_breaker circuit
   set opened_at = statement_timestamp() - interval '11 minutes',
       cooldown_until = statement_timestamp() - interval '1 minute'
 where circuit.singleton;

do $$
declare
    probe_id uuid;
begin
    if public.v2_dispatch_monitoring_push_worker_internal(8) <> 1 then
        raise exception 'recovery_probe_setup_failed';
    end if;
    select run.id into probe_id
      from public.v2_monitoring_push_dispatch_runs run
     where run.status = 'queued'
       and run.is_half_open_probe;
    perform public.v2_report_monitoring_push_worker_run_service(
        'monitoring-circuit-contract-capability-000001',
        probe_id,
        true,
        0,
        0,
        'no_work'
    );
end;
$$;

delete from public.v2_monitoring_push_dispatch_runs;

-- Exactly 50% is allowed; greater than 50% with at least four real provider
-- attempts opens the circuit. Expiry and device-state volume are not samples.
insert into public.v2_monitoring_push_dispatch_runs (
    id,
    source,
    dispatch_sequence,
    is_half_open_probe,
    status,
    result_code,
    provider_attempt_count,
    transient_failure_count,
    queued_at,
    completed_at
)
select
    (
        '44000000-0000-4000-8000-' ||
        lpad(sequence_no::text, 12, '0')
    )::uuid,
    'pg_cron',
    sequence_no,
    false,
    'succeeded',
    'provider_sample',
    1,
    case when sequence_no <= 2 then 1 else 0 end,
    circuit.provider_window_started_at + interval '1 millisecond',
    circuit.provider_window_started_at + interval '1 millisecond'
  from generate_series(1, 4) sequence_no
 cross join public.v2_monitoring_push_circuit_breaker circuit
 where circuit.singleton;

select public.v2_monitoring_push_apply_worker_signal_internal(
    true, false, 0, 0, 'no_work'
);

do $$
begin
    if not exists (
        select 1
          from public.v2_monitoring_push_circuit_breaker circuit
         where circuit.singleton
           and circuit.circuit_state = 'closed'
    ) then
        raise exception 'provider_rate_opened_at_exactly_fifty_percent';
    end if;
end;
$$;

update public.v2_monitoring_push_dispatch_runs run
   set transient_failure_count = 1
 where run.id = '44000000-0000-4000-8000-000000000003';

select public.v2_monitoring_push_apply_worker_signal_internal(
    true, false, 0, 0, 'no_work'
);

do $$
begin
    if not exists (
        select 1
          from public.v2_monitoring_push_circuit_breaker circuit
         where circuit.singleton
           and circuit.circuit_state = 'open'
           and circuit.open_reason = 'provider_transient_rate'
    ) then
        raise exception 'provider_transient_rate_did_not_open_circuit';
    end if;
end;
$$;

-- A healthy half-open provider probe closes the circuit and resets the rolling
-- sample boundary so old failures cannot immediately reopen it.
update public.v2_monitoring_push_dispatch_runs run
   set completed_at = statement_timestamp() - interval '1 minute'
 where run.id in (
    '44000000-0000-4000-8000-000000000001',
    '44000000-0000-4000-8000-000000000002',
    '44000000-0000-4000-8000-000000000003',
    '44000000-0000-4000-8000-000000000004'
 );

update public.v2_monitoring_push_circuit_breaker circuit
   set opened_at = statement_timestamp() - interval '11 minutes',
       cooldown_until = statement_timestamp() - interval '1 minute'
 where circuit.singleton;

do $$
declare
    probe_id uuid;
begin
    if public.v2_dispatch_monitoring_push_worker_internal(8) <> 1 then
        raise exception 'provider_recovery_probe_setup_failed';
    end if;
    select run.id into probe_id
      from public.v2_monitoring_push_dispatch_runs run
     where run.status = 'queued'
       and run.is_half_open_probe;
    perform public.v2_report_monitoring_push_worker_run_service(
        'monitoring-circuit-contract-capability-000001',
        probe_id,
        true,
        1,
        0,
        'delivery_provider_accepted'
    );
    perform public.v2_monitoring_push_apply_worker_signal_internal(
        true, false, 0, 0, 'no_work'
    );

    if not exists (
        select 1
          from public.v2_monitoring_push_circuit_breaker circuit
         where circuit.singleton
           and circuit.circuit_state = 'closed'
           and circuit.provider_window_started_at is not null
    ) then
        raise exception 'provider_recovery_probe_did_not_stably_close';
    end if;
end;
$$;

-- Cron results have an independent consecutive-failure counter. A success
-- resets it; three later failures open the circuit.
delete from public.v2_monitoring_push_dispatch_runs;
update public.v2_monitoring_push_circuit_breaker circuit
   set circuit_state = 'closed',
       consecutive_worker_failures = 0,
       consecutive_cron_failures = 0,
       open_reason = null,
       opened_at = null,
       cooldown_until = null,
       half_open_started_at = null,
       half_open_probe_dispatched_at = null,
       provider_window_started_at = statement_timestamp(),
       last_observed_cron_run_id = 0
 where circuit.singleton;

select public.v2_monitoring_push_record_cron_result_internal(1001, false);
select public.v2_monitoring_push_record_cron_result_internal(1002, false);
select public.v2_monitoring_push_record_cron_result_internal(1003, true);

do $$
begin
    if not exists (
        select 1
          from public.v2_monitoring_push_circuit_breaker circuit
         where circuit.singleton
           and circuit.circuit_state = 'closed'
           and circuit.consecutive_cron_failures = 0
           and circuit.last_observed_cron_run_id = 1003
    ) then
        raise exception 'cron_success_did_not_reset_failure_streak';
    end if;
end;
$$;

select public.v2_monitoring_push_record_cron_result_internal(1004, false);
select public.v2_monitoring_push_record_cron_result_internal(1005, false);
select public.v2_monitoring_push_record_cron_result_internal(1006, false);

do $$
begin
    if not exists (
        select 1
          from public.v2_monitoring_push_circuit_breaker circuit
         where circuit.singleton
           and circuit.circuit_state = 'open'
           and circuit.open_reason = 'cron_failures'
           and circuit.consecutive_cron_failures = 3
           and circuit.last_observed_cron_run_id = 1006
    ) then
        raise exception 'three_cron_failures_did_not_open_circuit';
    end if;
end;
$$;

-- Privilege contract: orchestration and state are owner-only; service_role can
-- report a run only through the separately capability-protected RPC.
do $$
declare
    private_table regclass;
    private_function regprocedure;
    role_name text;
    report_function constant regprocedure :=
        'public.v2_report_monitoring_push_worker_run_service(text,uuid,boolean,integer,integer,text)'::regprocedure;
begin
    foreach private_table in array array[
        'public.v2_monitoring_push_circuit_breaker'::regclass,
        'public.v2_monitoring_push_dispatch_runs'::regclass
    ] loop
        foreach role_name in array array['anon', 'authenticated', 'service_role']
        loop
            if has_table_privilege(role_name, private_table, 'SELECT')
               or has_table_privilege(role_name, private_table, 'INSERT')
               or has_table_privilege(role_name, private_table, 'UPDATE')
               or has_table_privilege(role_name, private_table, 'DELETE') then
                raise exception 'private_circuit_table_acl_failed:%:%',
                    private_table, role_name;
            end if;
        end loop;
        if not exists (
            select 1
              from pg_class relation
             where relation.oid = private_table
               and relation.relrowsecurity
               and relation.relforcerowsecurity
        ) then
            raise exception 'private_circuit_table_rls_failed:%', private_table;
        end if;
        if exists (
            select 1
              from pg_class relation
              cross join lateral aclexplode(
                  coalesce(
                      relation.relacl,
                      acldefault('r', relation.relowner)
                  )
              ) privilege
             where relation.oid = private_table
               and privilege.grantee = 0
        ) then
            raise exception 'public_circuit_table_acl_failed:%', private_table;
        end if;
    end loop;

    foreach private_function in array array[
        'public.v2_monitoring_push_circuit_audit_internal(text,text,jsonb)'::regprocedure,
        'public.v2_monitoring_push_open_circuit_internal(text,jsonb)'::regprocedure,
        'public.v2_monitoring_push_close_circuit_internal(jsonb)'::regprocedure,
        'public.v2_monitoring_push_apply_worker_signal_internal(boolean,boolean,integer,integer,text)'::regprocedure,
        'public.v2_monitoring_push_record_cron_result_internal(bigint,boolean)'::regprocedure,
        'public.v2_monitoring_push_refresh_circuit_internal()'::regprocedure,
        'public.v2_monitoring_push_circuit_dispatch_allowance_internal(integer)'::regprocedure,
        'public.v2_dispatch_monitoring_push_worker_internal(integer)'::regprocedure
    ] loop
        foreach role_name in array array['anon', 'authenticated', 'service_role']
        loop
            if has_function_privilege(
                role_name, private_function, 'EXECUTE'
            ) then
                raise exception 'owner_only_circuit_function_acl_failed:%:%',
                    private_function, role_name;
            end if;
        end loop;
        if exists (
            select 1
              from pg_proc procedure
              cross join lateral aclexplode(
                  coalesce(
                      procedure.proacl,
                      acldefault('f', procedure.proowner)
                  )
              ) privilege
             where procedure.oid = private_function
               and privilege.grantee = 0
               and privilege.privilege_type = 'EXECUTE'
        ) then
            raise exception 'public_circuit_function_acl_failed:%',
                private_function;
        end if;
    end loop;

    if has_function_privilege('anon', report_function, 'EXECUTE')
       or has_function_privilege('authenticated', report_function, 'EXECUTE')
       or not has_function_privilege('service_role', report_function, 'EXECUTE')
       or exists (
            select 1
              from pg_proc procedure
              cross join lateral aclexplode(
                  coalesce(
                      procedure.proacl,
                      acldefault('f', procedure.proowner)
                  )
              ) privilege
             where procedure.oid = report_function
               and privilege.grantee = 0
               and privilege.privilege_type = 'EXECUTE'
       ) then
        raise exception 'worker_report_rpc_acl_failed';
    end if;

    begin
        perform public.v2_report_monitoring_push_worker_run_service(
            repeat('X', 48),
            '44000000-0000-4000-8000-000000000001',
            true,
            0,
            0,
            'no_work'
        );
        raise exception 'worker_report_accepted_invalid_capability';
    exception
        when insufficient_privilege then
            if sqlerrm <> 'invalid_monitoring_push_worker_capability' then
                raise;
            end if;
    end;

    if exists (
        select 1
          from cron.job job
         where job.jobname = 'kippy-v2-monitoring-push'
            or job.command like
                '%v2_dispatch_monitoring_push_worker_internal%'
    ) then
        raise exception 'circuit_migration_activated_monitoring_cron';
    end if;
end;
$$;

select 'V2 monitoring push circuit breaker contract: PASS';

rollback;
