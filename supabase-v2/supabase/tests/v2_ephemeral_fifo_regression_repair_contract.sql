begin;

do $$
declare
    release_definition text;
    v4_definition text;
    v5_definition text;
    hardened_rpc_count integer;
    service_only_rpc_count integer;
    required_v3_marker text;
begin
    release_definition := pg_get_functiondef(
        'public.v2_release_ephemeral_incident_analysis_service(uuid,text)'::regprocedure
    );
    v4_definition := pg_get_functiondef(
        'public.v2_finalize_ephemeral_incident_analysis_service(uuid,text,text,text,text,text,text,text[],text,text,text,text,real,text[],text[])'::regprocedure
    );
    v5_definition := pg_get_functiondef(
        'public.v2_finalize_ephemeral_incident_analysis_service(uuid,text,text,text,text,text,text,text[],text,text,text,text,real,text[],text[],text)'::regprocedure
    );

    if position('v2_safety_incidents' in release_definition) > 0 then
        raise exception 'Release RPC still rewinds the incident state';
    end if;

    if position('kippy-expert-v4' in v4_definition) = 0
       or position('kippy-expert-v3' in v4_definition) > 0
       or position('target_prompt_version' in v4_definition) > 0 then
        raise exception 'Legacy finalizer is not the immutable v4 path';
    end if;

    foreach required_v3_marker in array array[
        'v2_valid_segment_refs',
        'v2_valid_expert_secondary_categories',
        'v2_v3_reason_for_inference',
        'v2_v3_action_for_inference',
        'v2_v3_channels_for_inference',
        'v2_incident_analysis_details',
        'inference_contract_version'
    ] loop
        if position(required_v3_marker in v4_definition) = 0 then
            raise exception 'Legacy finalizer lost V3 hardening: %',
                required_v3_marker;
        end if;
    end loop;

    if position('v2_incident_context' in v4_definition) > 0
       or position('v2_incident_analysis_jobs' in v4_definition) > 0 then
        raise exception 'Legacy finalizer can persist raw V3 context';
    end if;

    if position('kippy-expert-v5' in v5_definition) = 0
       or position('target_prompt_version' in v5_definition) = 0 then
        raise exception 'The additive v5 finalizer was not preserved';
    end if;

    select count(*)::integer
      into hardened_rpc_count
      from pg_proc procedure
     where procedure.oid in (
        'public.v2_release_ephemeral_incident_analysis_service(uuid,text)'::regprocedure,
        'public.v2_finalize_ephemeral_incident_analysis_service(uuid,text,text,text,text,text,text,text[],text,text,text,text,real,text[],text[])'::regprocedure,
        'public.v2_finalize_ephemeral_incident_analysis_service(uuid,text,text,text,text,text,text,text[],text,text,text,text,real,text[],text[],text)'::regprocedure
     )
       and procedure.prosecdef
       and exists (
            select 1
            from unnest(procedure.proconfig) setting
            where setting = 'search_path=""'
       );

    if hardened_rpc_count <> 3 then
        raise exception 'Ephemeral RPC security-definer contract failed';
    end if;

    select count(*)::integer
      into service_only_rpc_count
      from pg_proc procedure
     where procedure.oid in (
        'public.v2_release_ephemeral_incident_analysis_service(uuid,text)'::regprocedure,
        'public.v2_finalize_ephemeral_incident_analysis_service(uuid,text,text,text,text,text,text,text[],text,text,text,text,real,text[],text[])'::regprocedure,
        'public.v2_finalize_ephemeral_incident_analysis_service(uuid,text,text,text,text,text,text,text[],text,text,text,text,real,text[],text[],text)'::regprocedure
     )
       and procedure.proowner = 'postgres'::regrole
       and has_function_privilege('service_role', procedure.oid, 'EXECUTE')
       and not has_function_privilege('anon', procedure.oid, 'EXECUTE')
       and not has_function_privilege('authenticated', procedure.oid, 'EXECUTE');

    if service_only_rpc_count <> 3 then
        raise exception 'Ephemeral RPC execute grants are not service-role only';
    end if;
end
$$;

insert into auth.users (id)
values ('16000000-0000-4000-8000-000000000001');

insert into public.v2_families (id, display_name)
values (
    '26000000-0000-4000-8000-000000000001',
    'Ephemeral FIFO repair contract family'
);

insert into public.v2_guardian_memberships (
    family_id,
    guardian_user_id,
    role,
    status
) values (
    '26000000-0000-4000-8000-000000000001',
    '16000000-0000-4000-8000-000000000001',
    'owner',
    'active'
);

insert into public.v2_children (id, family_id, display_name)
values (
    '36000000-0000-4000-8000-000000000001',
    '26000000-0000-4000-8000-000000000001',
    'Ephemeral FIFO repair contract child'
);

insert into public.v2_protected_devices (
    id,
    child_id,
    installation_id,
    app_version,
    status
) values (
    '46000000-0000-4000-8000-000000000001',
    '36000000-0000-4000-8000-000000000001',
    '56000000-0000-4000-8000-000000000001',
    '2.0.0-fifo-repair-test',
    'active'
);

set local role service_role;

do $$
declare
    first_result record;
    wrong_lease_token text;
begin
    select * into first_result
    from public.v2_begin_ephemeral_incident_analysis_service(
        '46000000-0000-4000-8000-000000000001',
        '76000000-0000-4000-8000-000000000001',
        'exclusion',
        'high',
        'target',
        0.9::real,
        0.95::real,
        date_trunc('milliseconds', now() - interval '1 minute'),
        2::smallint,
        3::smallint,
        9::bigint,
        1::integer,
        2::smallint,
        date_trunc('milliseconds', now() + interval '1 day'),
        repeat('ab', 32),
        120::integer
    );

    if first_result.incident_id is null
       or first_result.created is not true
       or first_result.analysis_state is distinct from 'leased'
       or first_result.incident_status is distinct from 'analyzing'
       or char_length(first_result.lease_token) is distinct from 64 then
        raise exception 'Initial ephemeral lease was not created';
    end if;

    wrong_lease_token :=
        case left(first_result.lease_token, 1)
            when '0' then '1'
            else '0'
        end || substr(first_result.lease_token, 2);

    if public.v2_release_ephemeral_incident_analysis_service(
        first_result.incident_id,
        wrong_lease_token
    ) then
        raise exception 'Wrong-token release was accepted';
    end if;

    perform set_config(
        'test.ephemeral_fifo_repair_incident_id',
        first_result.incident_id::text,
        true
    );
    perform set_config(
        'test.ephemeral_fifo_repair_first_token',
        first_result.lease_token,
        true
    );
end
$$;

reset role;

do $$
declare
    target_incident_id uuid;
begin
    target_incident_id := current_setting(
        'test.ephemeral_fifo_repair_incident_id'
    )::uuid;

    if not exists (
        select 1
        from public.v2_ephemeral_incident_receipts receipt
        join public.v2_safety_incidents incident
          on incident.id = receipt.incident_id
        where receipt.incident_id = target_incident_id
          and receipt.state = 'leased'
          and receipt.lease_token_hash is not null
          and receipt.lease_expires_at > now()
          and incident.status = 'analyzing'
    ) then
        raise exception 'Wrong-token release changed the lease or incident';
    end if;
end
$$;

set local role service_role;

do $$
declare
    released boolean;
begin
    released := public.v2_release_ephemeral_incident_analysis_service(
        current_setting('test.ephemeral_fifo_repair_incident_id')::uuid,
        current_setting('test.ephemeral_fifo_repair_first_token')
    );

    if released is not true then
        raise exception 'Correct-token release was rejected';
    end if;
end
$$;

reset role;

do $$
declare
    target_incident_id uuid;
begin
    target_incident_id := current_setting(
        'test.ephemeral_fifo_repair_incident_id'
    )::uuid;

    if not exists (
        select 1
        from public.v2_ephemeral_incident_receipts receipt
        join public.v2_safety_incidents incident
          on incident.id = receipt.incident_id
        where receipt.incident_id = target_incident_id
          and receipt.state = 'received'
          and receipt.lease_token_hash is null
          and receipt.lease_expires_at is null
          and incident.status = 'analyzing'
    ) then
        raise exception 'Release did not make only the receipt retryable';
    end if;

    if exists (
        select 1
        from public.v2_incident_analysis analysis
        where analysis.incident_id = target_incident_id
    ) then
        raise exception 'Release unexpectedly persisted an analysis';
    end if;
end
$$;

set local role service_role;

do $$
declare
    retry_result record;
    final_result record;
begin
    select * into retry_result
    from public.v2_begin_ephemeral_incident_analysis_service(
        '46000000-0000-4000-8000-000000000001',
        '76000000-0000-4000-8000-000000000001',
        'exclusion',
        'high',
        'target',
        0.9::real,
        0.95::real,
        date_trunc('milliseconds', now() - interval '1 minute'),
        2::smallint,
        3::smallint,
        9::bigint,
        1::integer,
        2::smallint,
        date_trunc('milliseconds', now() + interval '1 day'),
        repeat('ab', 32),
        120::integer
    );

    if retry_result.created is not false
       or retry_result.analysis_state is distinct from 'leased'
       or retry_result.incident_status is distinct from 'analyzing'
       or char_length(retry_result.lease_token) is distinct from 64
       or retry_result.lease_token is not distinct from
            current_setting('test.ephemeral_fifo_repair_first_token') then
        raise exception 'Released receipt was not immediately re-leased';
    end if;

    select * into final_result
    from public.v2_finalize_ephemeral_incident_analysis_service(
        retry_result.incident_id,
        retry_result.lease_token,
        'confirmed',
        'exclusion_pattern',
        'professional_support',
        'gpt-5.6-luna',
        'exclusion',
        array[]::text[],
        'high',
        'elevated',
        'target',
        'repeated',
        0.91::real,
        array['AAAAAAAAAAAAAAAAAAAAAA']::text[],
        array['in_app', 'push']::text[]
    );

    if final_result.incident_status is distinct from 'confirmed'
       or final_result.analysis_outcome is distinct from 'confirmed'
       or final_result.delivery_count is distinct from 2 then
        raise exception 'Legacy v4 finalizer returned an unexpected result';
    end if;
end
$$;

reset role;

do $$
declare
    target_incident_id uuid;
begin
    target_incident_id := current_setting(
        'test.ephemeral_fifo_repair_incident_id'
    )::uuid;

    if not exists (
        select 1
        from public.v2_safety_incidents incident
        join public.v2_incident_analysis analysis
          on analysis.incident_id = incident.id
        join public.v2_incident_analysis_details details
          on details.incident_id = incident.id
        join public.v2_ephemeral_incident_receipts receipt
          on receipt.incident_id = incident.id
        where incident.id = target_incident_id
          and incident.status = 'confirmed'
          and incident.privacy_contract_version = 3
          and analysis.outcome = 'confirmed'
          and analysis.prompt_version = 'kippy-expert-v4'
          and analysis.safe_summary is not null
          and analysis.safe_reason is not null
          and analysis.recommended_action is not null
          and details.expert_category = 'exclusion'
          and details.inference_contract_version = 3
          and details.evidence_segment_refs =
                array['AAAAAAAAAAAAAAAAAAAAAA']::text[]
          and receipt.state = 'completed'
          and receipt.lease_token_hash is null
          and receipt.lease_expires_at is null
          and octet_length(receipt.completion_request_hash) = 32
          and octet_length(receipt.completion_lease_token_hash) = 32
    ) then
        raise exception 'V4 finalization or V3 privacy result is incomplete';
    end if;

    if (
        select count(*)
        from public.v2_alert_deliveries delivery
        where delivery.incident_id = target_incident_id
    ) <> 2 then
        raise exception 'Expected exactly two parent alert intents';
    end if;

    if exists (
        select 1
        from public.v2_incident_context context
        where context.incident_id = target_incident_id
    ) or exists (
        select 1
        from public.v2_incident_analysis_jobs job
        where job.incident_id = target_incident_id
    ) then
        raise exception 'V3 context crossed the ephemeral persistence boundary';
    end if;
end
$$;

set local role service_role;

do $$
declare
    v5_begin_result record;
    v5_final_result record;
begin
    select * into v5_begin_result
    from public.v2_begin_ephemeral_incident_analysis_service(
        '46000000-0000-4000-8000-000000000001',
        '76000000-0000-4000-8000-000000000002',
        'exclusion',
        'high',
        'target',
        0.9::real,
        0.95::real,
        date_trunc('milliseconds', now() - interval '1 minute'),
        2::smallint,
        3::smallint,
        10::bigint,
        1::integer,
        2::smallint,
        date_trunc('milliseconds', now() + interval '1 day'),
        repeat('cd', 32),
        120::integer
    );

    if v5_begin_result.incident_id is null
       or v5_begin_result.created is not true
       or v5_begin_result.analysis_state is distinct from 'leased'
       or char_length(v5_begin_result.lease_token) is distinct from 64 then
        raise exception 'V5 preservation lease was not created';
    end if;

    begin
        perform *
        from public.v2_finalize_ephemeral_incident_analysis_service(
            v5_begin_result.incident_id,
            v5_begin_result.lease_token,
            'confirmed',
            'exclusion_pattern',
            'professional_support',
            'gpt-5.6-luna',
            'exclusion',
            array[]::text[],
            'high',
            'elevated',
            'target',
            'repeated',
            0.91::real,
            array['BBBBBBBBBBBBBBBBBBBBBB']::text[],
            array['in_app', 'push']::text[],
            'kippy-expert-v4'
        );
        raise exception 'V5 overload accepted a non-v5 prompt version';
    exception
        when invalid_parameter_value then
            if sqlerrm <> 'invalid_expert_prompt_version' then
                raise;
            end if;
    end;

    select * into v5_final_result
    from public.v2_finalize_ephemeral_incident_analysis_service(
        v5_begin_result.incident_id,
        v5_begin_result.lease_token,
        'confirmed',
        'exclusion_pattern',
        'professional_support',
        'gpt-5.6-luna',
        'exclusion',
        array[]::text[],
        'high',
        'elevated',
        'target',
        'repeated',
        0.91::real,
        array['BBBBBBBBBBBBBBBBBBBBBB']::text[],
        array['in_app', 'push']::text[],
        'kippy-expert-v5'
    );

    if v5_final_result.incident_status is distinct from 'confirmed'
       or v5_final_result.analysis_outcome is distinct from 'confirmed'
       or v5_final_result.delivery_count is distinct from 2 then
        raise exception 'V5 finalizer behavior was not preserved';
    end if;

    perform set_config(
        'test.ephemeral_fifo_repair_v5_incident_id',
        v5_begin_result.incident_id::text,
        true
    );
end
$$;

reset role;

do $$
declare
    target_incident_id uuid;
begin
    target_incident_id := current_setting(
        'test.ephemeral_fifo_repair_v5_incident_id'
    )::uuid;

    if not exists (
        select 1
        from public.v2_safety_incidents incident
        join public.v2_incident_analysis analysis
          on analysis.incident_id = incident.id
        join public.v2_incident_analysis_details details
          on details.incident_id = incident.id
        join public.v2_ephemeral_incident_receipts receipt
          on receipt.incident_id = incident.id
        where incident.id = target_incident_id
          and incident.status = 'confirmed'
          and incident.privacy_contract_version = 3
          and analysis.outcome = 'confirmed'
          and analysis.prompt_version = 'kippy-expert-v5'
          and details.inference_contract_version = 3
          and details.evidence_segment_refs =
                array['BBBBBBBBBBBBBBBBBBBBBB']::text[]
          and receipt.state = 'completed'
          and receipt.lease_token_hash is null
          and receipt.lease_expires_at is null
    ) then
        raise exception 'V5 finalization lost its V3 privacy boundary';
    end if;

    if exists (
        select 1
        from public.v2_incident_context context
        where context.incident_id = target_incident_id
    ) or exists (
        select 1
        from public.v2_incident_analysis_jobs job
        where job.incident_id = target_incident_id
    ) then
        raise exception 'V5 path persisted raw V3 context';
    end if;
end
$$;

rollback;
