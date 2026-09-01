begin;

-- Gate D remains dormant until an owner separately creates and activates the
-- recurring job. This migration adds only bounded circuit state, dispatch-run
-- evidence, and the fail-closed orchestration contract.
create table public.v2_monitoring_push_circuit_breaker (
    singleton boolean primary key default true check (singleton),
    circuit_state text not null default 'closed'
        check (circuit_state in ('closed', 'open', 'half_open')),
    consecutive_worker_failures integer not null default 0
        check (consecutive_worker_failures between 0 and 1000),
    consecutive_cron_failures integer not null default 0
        check (consecutive_cron_failures between 0 and 1000),
    open_reason text
        check (
            open_reason is null
            or open_reason in (
                'worker_failures',
                'cron_failures',
                'provider_transient_rate'
            )
        ),
    opened_at timestamptz,
    cooldown_until timestamptz,
    half_open_started_at timestamptz,
    half_open_probe_dispatched_at timestamptz,
    last_worker_success_at timestamptz,
    last_worker_failure_at timestamptz,
    last_cron_success_at timestamptz,
    last_cron_failure_at timestamptz,
    provider_window_started_at timestamptz not null default now(),
    last_observed_cron_run_id bigint not null default 0
        check (last_observed_cron_run_id >= 0),
    updated_at timestamptz not null default now(),
    constraint v2_monitoring_push_circuit_state_shape check (
        (
            circuit_state = 'closed'
            and open_reason is null
            and opened_at is null
            and cooldown_until is null
            and half_open_started_at is null
            and half_open_probe_dispatched_at is null
        )
        or (
            circuit_state = 'open'
            and open_reason is not null
            and opened_at is not null
            and cooldown_until > opened_at
            and half_open_started_at is null
            and half_open_probe_dispatched_at is null
        )
        or (
            circuit_state = 'half_open'
            and open_reason is not null
            and opened_at is not null
            and cooldown_until is not null
            and half_open_started_at is not null
        )
    )
);

create trigger v2_monitoring_push_circuit_set_updated_at
before update on public.v2_monitoring_push_circuit_breaker
for each row execute function public.v2_set_updated_at();

insert into public.v2_monitoring_push_circuit_breaker (singleton)
values (true);

alter table public.v2_monitoring_push_circuit_breaker
    enable row level security;
alter table public.v2_monitoring_push_circuit_breaker
    force row level security;
revoke all on table public.v2_monitoring_push_circuit_breaker
from public, anon, authenticated, service_role;

create table public.v2_monitoring_push_dispatch_runs (
    id uuid primary key,
    request_id bigint,
    source text not null default 'pg_cron'
        check (source = 'pg_cron'),
    dispatch_sequence integer not null
        check (dispatch_sequence between 1 and 8),
    is_half_open_probe boolean not null default false,
    status text not null default 'queued'
        check (status in ('queued', 'succeeded', 'failed')),
    result_code text
        check (
            result_code is null
            or (
                char_length(result_code) between 1 and 80
                and result_code ~ '^[a-z0-9_]+$'
            )
        ),
    provider_attempt_count integer not null default 0
        check (provider_attempt_count between 0 and 8),
    transient_failure_count integer not null default 0
        check (
            transient_failure_count between 0 and 8
            and transient_failure_count <= provider_attempt_count
        ),
    queued_at timestamptz not null default now(),
    completed_at timestamptz,
    constraint v2_monitoring_push_dispatch_run_terminal_shape check (
        (
            status = 'queued'
            and result_code is null
            and completed_at is null
            and provider_attempt_count = 0
            and transient_failure_count = 0
        )
        or (
            status in ('succeeded', 'failed')
            and result_code is not null
            and completed_at is not null
        )
    )
);

create unique index v2_monitoring_push_dispatch_request
    on public.v2_monitoring_push_dispatch_runs(request_id)
    where request_id is not null;
create index v2_monitoring_push_dispatch_stale
    on public.v2_monitoring_push_dispatch_runs(queued_at)
    where status = 'queued';
create index v2_monitoring_push_dispatch_recent_results
    on public.v2_monitoring_push_dispatch_runs(completed_at desc)
    where status in ('succeeded', 'failed');

alter table public.v2_monitoring_push_dispatch_runs
    enable row level security;
alter table public.v2_monitoring_push_dispatch_runs
    force row level security;
revoke all on table public.v2_monitoring_push_dispatch_runs
from public, anon, authenticated, service_role;

create or replace function public.v2_monitoring_push_circuit_audit_internal(
    target_action text,
    target_outcome text,
    target_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if target_action is null
       or char_length(target_action) not between 1 and 48
       or target_action !~ '^[a-z0-9_]+$'
       or target_outcome not in ('success', 'denied', 'failed')
       or target_metadata is null
       or jsonb_typeof(target_metadata) <> 'object' then
        raise exception 'invalid_monitoring_push_circuit_audit'
            using errcode = '22023';
    end if;

    insert into public.v2_audit_events (
        actor_type,
        action,
        object_type,
        outcome,
        metadata
    )
    values (
        'system',
        'v2.monitoring.push_circuit.' || target_action,
        'monitoring_push_circuit_breaker',
        target_outcome,
        target_metadata
    );
end;
$$;

create or replace function public.v2_monitoring_push_open_circuit_internal(
    target_reason text,
    target_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    circuit public.v2_monitoring_push_circuit_breaker%rowtype;
    resolved_opened_at timestamptz := statement_timestamp();
    resolved_cooldown_until timestamptz :=
        statement_timestamp() + interval '10 minutes';
begin
    if target_reason not in (
        'worker_failures',
        'cron_failures',
        'provider_transient_rate'
    ) or target_metadata is null
      or jsonb_typeof(target_metadata) <> 'object' then
        raise exception 'invalid_monitoring_push_circuit_open'
            using errcode = '22023';
    end if;

    select current_circuit.*
      into circuit
      from public.v2_monitoring_push_circuit_breaker current_circuit
     where current_circuit.singleton
     for update;

    if not found then
        raise exception 'monitoring_push_circuit_state_missing'
            using errcode = '55000';
    end if;

    if circuit.circuit_state = 'open' then
        return;
    end if;

    update public.v2_monitoring_push_circuit_breaker current_circuit
       set circuit_state = 'open',
           open_reason = target_reason,
           opened_at = resolved_opened_at,
           cooldown_until = resolved_cooldown_until,
           half_open_started_at = null,
           half_open_probe_dispatched_at = null
     where current_circuit.singleton;

    perform public.v2_monitoring_push_circuit_audit_internal(
        case when circuit.circuit_state = 'half_open'
            then 'reopen'
            else 'open'
        end,
        'failed',
        target_metadata || jsonb_build_object(
            'reason', target_reason,
            'previous_state', circuit.circuit_state,
            'cooldown_seconds', 600,
            'consecutive_worker_failures',
                circuit.consecutive_worker_failures,
            'consecutive_cron_failures',
                circuit.consecutive_cron_failures
        )
    );
end;
$$;

create or replace function public.v2_monitoring_push_close_circuit_internal(
    target_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    circuit public.v2_monitoring_push_circuit_breaker%rowtype;
begin
    if target_metadata is null
       or jsonb_typeof(target_metadata) <> 'object' then
        raise exception 'invalid_monitoring_push_circuit_close'
            using errcode = '22023';
    end if;

    select current_circuit.*
      into circuit
      from public.v2_monitoring_push_circuit_breaker current_circuit
     where current_circuit.singleton
     for update;

    if not found then
        raise exception 'monitoring_push_circuit_state_missing'
            using errcode = '55000';
    end if;
    if circuit.circuit_state <> 'half_open' then
        raise exception 'monitoring_push_circuit_close_requires_half_open'
            using errcode = '55000';
    end if;

    update public.v2_monitoring_push_circuit_breaker current_circuit
       set circuit_state = 'closed',
           consecutive_worker_failures = 0,
           consecutive_cron_failures = 0,
           open_reason = null,
           opened_at = null,
           cooldown_until = null,
           half_open_started_at = null,
           half_open_probe_dispatched_at = null,
           provider_window_started_at = statement_timestamp()
     where current_circuit.singleton;

    perform public.v2_monitoring_push_circuit_audit_internal(
        'close',
        'success',
        target_metadata || jsonb_build_object(
            'previous_reason', circuit.open_reason
        )
    );
end;
$$;

create or replace function public.v2_monitoring_push_apply_worker_signal_internal(
    target_worker_succeeded boolean,
    target_is_half_open_probe boolean,
    target_provider_attempt_count integer,
    target_transient_failure_count integer,
    target_result_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    circuit public.v2_monitoring_push_circuit_breaker%rowtype;
    resolved_worker_failures integer;
    window_provider_attempts bigint;
    window_transient_failures bigint;
begin
    if target_worker_succeeded is null
       or target_is_half_open_probe is null
       or target_provider_attempt_count is null
       or target_provider_attempt_count not between 0 and 8
       or target_transient_failure_count is null
       or target_transient_failure_count not between 0 and 8
       or target_transient_failure_count > target_provider_attempt_count
       or target_result_code is null
       or char_length(target_result_code) not between 1 and 80
       or target_result_code !~ '^[a-z0-9_]+$' then
        raise exception 'invalid_monitoring_push_worker_signal'
            using errcode = '22023';
    end if;

    select current_circuit.*
      into circuit
      from public.v2_monitoring_push_circuit_breaker current_circuit
     where current_circuit.singleton
     for update;

    if not found then
        raise exception 'monitoring_push_circuit_state_missing'
            using errcode = '55000';
    end if;

    resolved_worker_failures := case
        when target_worker_succeeded then 0
        else least(circuit.consecutive_worker_failures + 1, 1000)
    end;

    update public.v2_monitoring_push_circuit_breaker current_circuit
       set consecutive_worker_failures = resolved_worker_failures,
           last_worker_success_at = case
               when target_worker_succeeded
                   then statement_timestamp()
               else current_circuit.last_worker_success_at
           end,
           last_worker_failure_at = case
               when not target_worker_succeeded
                   then statement_timestamp()
               else current_circuit.last_worker_failure_at
           end
     where current_circuit.singleton;

    if circuit.circuit_state = 'half_open'
       and target_is_half_open_probe then
        if not target_worker_succeeded then
            perform public.v2_monitoring_push_open_circuit_internal(
                'worker_failures',
                jsonb_build_object(
                    'probe_result_code', target_result_code
                )
            );
        elsif target_transient_failure_count > 0 then
            perform public.v2_monitoring_push_open_circuit_internal(
                'provider_transient_rate',
                jsonb_build_object(
                    'probe_provider_attempts',
                        target_provider_attempt_count,
                    'probe_transient_failures',
                        target_transient_failure_count
                )
            );
        elsif circuit.open_reason = 'provider_transient_rate'
          and target_provider_attempt_count = 0 then
            update public.v2_monitoring_push_circuit_breaker current_circuit
               set half_open_probe_dispatched_at = null
             where current_circuit.singleton;
            perform public.v2_monitoring_push_circuit_audit_internal(
                'probe_inconclusive',
                'denied',
                jsonb_build_object(
                    'reason', 'provider_probe_without_provider_attempt'
                )
            );
        else
            perform public.v2_monitoring_push_close_circuit_internal(
                jsonb_build_object(
                    'probe_result_code', target_result_code,
                    'probe_provider_attempts',
                        target_provider_attempt_count
                )
            );
        end if;
        return;
    end if;

    if circuit.circuit_state = 'half_open'
       and not target_worker_succeeded then
        perform public.v2_monitoring_push_open_circuit_internal(
            'worker_failures',
            jsonb_build_object(
                'result_code', target_result_code,
                'probe', false
            )
        );
        return;
    end if;

    if circuit.circuit_state = 'closed'
       and not target_worker_succeeded
       and resolved_worker_failures >= 3 then
        perform public.v2_monitoring_push_open_circuit_internal(
            'worker_failures',
            jsonb_build_object(
                'result_code', target_result_code,
                'failure_threshold', 3
            )
        );
        return;
    end if;

    select
        coalesce(sum(run.provider_attempt_count), 0),
        coalesce(sum(run.transient_failure_count), 0)
      into window_provider_attempts, window_transient_failures
      from public.v2_monitoring_push_dispatch_runs run
     where run.status in ('succeeded', 'failed')
       and run.completed_at > greatest(
            statement_timestamp() - interval '5 minutes',
            circuit.provider_window_started_at
       );

    if circuit.circuit_state = 'closed'
       and window_provider_attempts >= 4
       and window_transient_failures * 2 > window_provider_attempts then
        perform public.v2_monitoring_push_open_circuit_internal(
            'provider_transient_rate',
            jsonb_build_object(
                'window_seconds', 300,
                'sample_minimum', 4,
                'provider_attempts', window_provider_attempts,
                'transient_failures', window_transient_failures
            )
        );
    end if;
end;
$$;

create or replace function public.v2_monitoring_push_record_cron_result_internal(
    target_cron_run_id bigint,
    target_succeeded boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    circuit public.v2_monitoring_push_circuit_breaker%rowtype;
    resolved_cron_failures integer;
begin
    if target_cron_run_id is null
       or target_cron_run_id <= 0
       or target_succeeded is null then
        raise exception 'invalid_monitoring_push_cron_signal'
            using errcode = '22023';
    end if;

    select current_circuit.*
      into circuit
      from public.v2_monitoring_push_circuit_breaker current_circuit
     where current_circuit.singleton
     for update;

    if not found then
        raise exception 'monitoring_push_circuit_state_missing'
            using errcode = '55000';
    end if;
    if target_cron_run_id <= circuit.last_observed_cron_run_id then
        return;
    end if;

    resolved_cron_failures := case
        when target_succeeded then 0
        else least(circuit.consecutive_cron_failures + 1, 1000)
    end;

    update public.v2_monitoring_push_circuit_breaker current_circuit
       set consecutive_cron_failures = resolved_cron_failures,
           last_observed_cron_run_id = target_cron_run_id,
           last_cron_success_at = case
               when target_succeeded
                   then statement_timestamp()
               else current_circuit.last_cron_success_at
           end,
           last_cron_failure_at = case
               when not target_succeeded
                   then statement_timestamp()
               else current_circuit.last_cron_failure_at
           end
     where current_circuit.singleton;

    if not target_succeeded
       and (
            circuit.circuit_state = 'half_open'
            or (
                circuit.circuit_state = 'closed'
                and resolved_cron_failures >= 3
            )
       ) then
        perform public.v2_monitoring_push_open_circuit_internal(
            'cron_failures',
            jsonb_build_object(
                'cron_run_id', target_cron_run_id,
                'failure_threshold', 3
            )
        );
    end if;
end;
$$;

create or replace function public.v2_monitoring_push_refresh_circuit_internal()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    stale_run record;
    cron_result record;
    last_observed_run_id bigint;
begin
    for stale_run in
        select run.id, run.is_half_open_probe
          from public.v2_monitoring_push_dispatch_runs run
         where run.status = 'queued'
           and run.queued_at <= statement_timestamp() - interval '90 seconds'
         order by run.queued_at, run.id
         for update skip locked
    loop
        update public.v2_monitoring_push_dispatch_runs run
           set status = 'failed',
               result_code = 'worker_timeout',
               completed_at = statement_timestamp()
         where run.id = stale_run.id
           and run.status = 'queued';

        if found then
            perform public.v2_monitoring_push_apply_worker_signal_internal(
                false,
                stale_run.is_half_open_probe,
                0,
                0,
                'worker_timeout'
            );
        end if;
    end loop;

    select circuit.last_observed_cron_run_id
      into last_observed_run_id
      from public.v2_monitoring_push_circuit_breaker circuit
     where circuit.singleton;

    for cron_result in
        select detail.runid, detail.status
          from cron.job_run_details detail
          join cron.job job on job.jobid = detail.jobid
         where job.jobname = 'kippy-v2-monitoring-push'
           and detail.runid > coalesce(last_observed_run_id, 0)
           and detail.status in ('succeeded', 'failed')
         order by detail.runid
    loop
        perform public.v2_monitoring_push_record_cron_result_internal(
            cron_result.runid,
            cron_result.status = 'succeeded'
        );
    end loop;
end;
$$;

create or replace function public.v2_monitoring_push_circuit_dispatch_allowance_internal(
    target_requested_bound integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    circuit public.v2_monitoring_push_circuit_breaker%rowtype;
begin
    if target_requested_bound is null
       or target_requested_bound not between 1 and 8 then
        raise exception 'invalid_monitoring_push_dispatch_batch'
            using errcode = '22023';
    end if;

    select current_circuit.*
      into circuit
      from public.v2_monitoring_push_circuit_breaker current_circuit
     where current_circuit.singleton
     for update;

    if not found then
        return 0;
    end if;
    if circuit.circuit_state = 'closed' then
        return target_requested_bound;
    end if;

    if circuit.circuit_state = 'open'
       and circuit.cooldown_until > statement_timestamp() then
        perform public.v2_monitoring_push_circuit_audit_internal(
            'block',
            'denied',
            jsonb_build_object(
                'state', 'open',
                'reason', circuit.open_reason,
                'cooldown_until', circuit.cooldown_until,
                'requested_bound', target_requested_bound
            )
        );
        return 0;
    end if;

    if circuit.circuit_state = 'open' then
        update public.v2_monitoring_push_circuit_breaker current_circuit
           set circuit_state = 'half_open',
               half_open_started_at = statement_timestamp(),
               half_open_probe_dispatched_at = statement_timestamp()
         where current_circuit.singleton;
        perform public.v2_monitoring_push_circuit_audit_internal(
            'half_open',
            'success',
            jsonb_build_object(
                'previous_reason', circuit.open_reason,
                'probe_bound', 1
            )
        );
        return 1;
    end if;

    if circuit.half_open_probe_dispatched_at is null then
        update public.v2_monitoring_push_circuit_breaker current_circuit
           set half_open_probe_dispatched_at = statement_timestamp()
         where current_circuit.singleton;
        return 1;
    end if;

    perform public.v2_monitoring_push_circuit_audit_internal(
        'block',
        'denied',
        jsonb_build_object(
            'state', 'half_open',
            'reason', circuit.open_reason,
            'requested_bound', target_requested_bound
        )
    );
    return 0;
end;
$$;

create or replace function public.v2_report_monitoring_push_worker_run_service(
    target_capability_token text,
    target_dispatch_id uuid,
    target_worker_succeeded boolean,
    target_provider_attempt_count integer,
    target_transient_failure_count integer,
    target_result_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    dispatch_run public.v2_monitoring_push_dispatch_runs%rowtype;
    resolved_status text;
begin
    if not public.v2_monitoring_push_capability_is_valid(
        target_capability_token
    ) then
        raise exception 'invalid_monitoring_push_worker_capability'
            using errcode = '42501';
    end if;

    if target_dispatch_id is null
       or target_worker_succeeded is null
       or target_provider_attempt_count is null
       or target_provider_attempt_count not between 0 and 8
       or target_transient_failure_count is null
       or target_transient_failure_count not between 0 and 8
       or target_transient_failure_count > target_provider_attempt_count
       or target_result_code is null
       or char_length(target_result_code) not between 1 and 80
       or target_result_code !~ '^[a-z0-9_]+$' then
        raise exception 'invalid_monitoring_push_worker_run_report'
            using errcode = '22023';
    end if;

    select run.*
      into dispatch_run
      from public.v2_monitoring_push_dispatch_runs run
     where run.id = target_dispatch_id
     for update;

    if not found then
        raise exception 'monitoring_push_dispatch_run_missing'
            using errcode = '22023';
    end if;

    resolved_status := case
        when target_worker_succeeded then 'succeeded'
        else 'failed'
    end;

    if dispatch_run.status <> 'queued' then
        if dispatch_run.status = resolved_status
           and dispatch_run.result_code = target_result_code
           and dispatch_run.provider_attempt_count =
                target_provider_attempt_count
           and dispatch_run.transient_failure_count =
                target_transient_failure_count then
            return;
        end if;
        raise exception 'monitoring_push_dispatch_run_already_completed'
            using errcode = '55000';
    end if;

    update public.v2_monitoring_push_dispatch_runs run
       set status = resolved_status,
           result_code = target_result_code,
           provider_attempt_count = target_provider_attempt_count,
           transient_failure_count = target_transient_failure_count,
           completed_at = statement_timestamp()
     where run.id = target_dispatch_id;

    perform public.v2_monitoring_push_apply_worker_signal_internal(
        target_worker_succeeded,
        dispatch_run.is_half_open_probe,
        target_provider_attempt_count,
        target_transient_failure_count,
        target_result_code
    );
end;
$$;

-- The owner-only dispatcher remains unscheduled. Circuit evaluation happens
-- before Vault reads or HTTP enqueue, so an open circuit cannot mutate the
-- monitoring queue or create a network request.
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
    due_count integer;
    dispatch_count integer;
    dispatch_index integer;
    successful_dispatch_count integer := 0;
    dispatch_id uuid;
    resolved_request_id bigint;
    is_half_open_probe boolean := false;
begin
    if target_max_requests is null
       or target_max_requests not between 1 and 8 then
        raise exception 'invalid_monitoring_push_dispatch_batch'
            using errcode = '22023';
    end if;

    -- pg_cron serializes one named job, while this lock also prevents a manual
    -- owner invocation from widening the same dispatch window.
    if not pg_catalog.pg_try_advisory_xact_lock(20260901, 180000) then
        perform public.v2_monitoring_push_circuit_audit_internal(
            'block',
            'denied',
            jsonb_build_object('reason', 'concurrent_dispatch')
        );
        return 0;
    end if;

    perform public.v2_monitoring_push_refresh_circuit_internal();

    due_count := public.v2_monitoring_push_due_dispatch_count_internal(
        target_max_requests
    );
    if due_count = 0 then
        return 0;
    end if;

    dispatch_count :=
        public.v2_monitoring_push_circuit_dispatch_allowance_internal(
            due_count
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

    select circuit.circuit_state = 'half_open'
      into is_half_open_probe
      from public.v2_monitoring_push_circuit_breaker circuit
     where circuit.singleton;

    if worker_endpoint is null
       or worker_endpoint !~
            '^https://[A-Za-z0-9.-]+/functions/v1/v2-deliver-monitoring-push$'
       or worker_trigger_token is null
       or char_length(worker_trigger_token) not between 32 and 256 then
        perform public.v2_monitoring_push_apply_worker_signal_internal(
            false,
            coalesce(is_half_open_probe, false),
            0,
            0,
            'dispatcher_configuration_incomplete'
        );
        return 0;
    end if;

    for dispatch_index in 1..dispatch_count loop
        dispatch_id := extensions.gen_random_uuid();

        insert into public.v2_monitoring_push_dispatch_runs (
            id,
            source,
            dispatch_sequence,
            is_half_open_probe,
            queued_at
        )
        values (
            dispatch_id,
            'pg_cron',
            dispatch_index,
            is_half_open_probe and dispatch_index = 1,
            statement_timestamp()
        );

        begin
            select net.http_post(
                url := worker_endpoint,
                headers := jsonb_build_object(
                    'Content-Type',
                    'application/json',
                    'x-kippy-monitoring-push-token',
                    worker_trigger_token
                ),
                body := jsonb_build_object(
                    'contract_version',
                    1,
                    'source',
                    'pg_cron',
                    'dispatch_id',
                    dispatch_id,
                    'dispatch_sequence',
                    dispatch_index
                ),
                timeout_milliseconds := 25000
            ) into resolved_request_id;

            if resolved_request_id is null then
                raise exception 'monitoring_push_http_request_id_missing'
                    using errcode = '55000';
            end if;

            update public.v2_monitoring_push_dispatch_runs run
               set request_id = resolved_request_id
             where run.id = dispatch_id;
            successful_dispatch_count := successful_dispatch_count + 1;
        exception
            when others then
                update public.v2_monitoring_push_dispatch_runs run
                   set status = 'failed',
                       result_code = 'dispatcher_http_enqueue_failed',
                       completed_at = statement_timestamp()
                 where run.id = dispatch_id;
                perform public.v2_monitoring_push_apply_worker_signal_internal(
                    false,
                    is_half_open_probe and dispatch_index = 1,
                    0,
                    0,
                    'dispatcher_http_enqueue_failed'
                );
                exit;
        end;
    end loop;

    return successful_dispatch_count;
end;
$$;

revoke all on function
    public.v2_monitoring_push_circuit_audit_internal(text, text, jsonb),
    public.v2_monitoring_push_open_circuit_internal(text, jsonb),
    public.v2_monitoring_push_close_circuit_internal(jsonb),
    public.v2_monitoring_push_apply_worker_signal_internal(
        boolean, boolean, integer, integer, text
    ),
    public.v2_monitoring_push_record_cron_result_internal(bigint, boolean),
    public.v2_monitoring_push_refresh_circuit_internal(),
    public.v2_monitoring_push_circuit_dispatch_allowance_internal(integer),
    public.v2_dispatch_monitoring_push_worker_internal(integer),
    public.v2_report_monitoring_push_worker_run_service(
        text, uuid, boolean, integer, integer, text
    )
from public, anon, authenticated, service_role;

grant execute on function
    public.v2_report_monitoring_push_worker_run_service(
        text, uuid, boolean, integer, integer, text
    )
to service_role;

comment on table public.v2_monitoring_push_circuit_breaker is
    'Owner-only monitoring delivery circuit. Queue volume alone never opens it; only technical worker/cron failures or provider transient rate do.';
comment on column
    public.v2_monitoring_push_circuit_breaker.provider_window_started_at is
    'Lower bound for the rolling provider sample. Successful half-open recovery advances it so pre-recovery failures cannot immediately reopen the circuit.';
comment on table public.v2_monitoring_push_dispatch_runs is
    'Private bounded dispatcher evidence used for worker timeout detection, provider transient-rate evaluation, and one-request half-open probes.';
comment on function
    public.v2_report_monitoring_push_worker_run_service(
        text, uuid, boolean, integer, integer, text
    ) is
    'Capability-protected worker result report. It contains counts and status codes only, never endpoint or child data.';
comment on function
    public.v2_dispatch_monitoring_push_worker_internal(integer) is
    'Owner-only, unscheduled monitoring dispatcher. Returns zero while the circuit is open and permits exactly one probe after the ten-minute cooldown.';

commit;
