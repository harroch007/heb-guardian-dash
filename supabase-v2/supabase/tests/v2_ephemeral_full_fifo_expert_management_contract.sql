begin;

insert into auth.users (id)
values ('15000000-0000-4000-8000-000000000001');

insert into public.v2_families (id, display_name)
values (
    '25000000-0000-4000-8000-000000000001',
    'Ephemeral expert contract family'
);

insert into public.v2_guardian_memberships (
    family_id,
    guardian_user_id,
    role,
    status
) values (
    '25000000-0000-4000-8000-000000000001',
    '15000000-0000-4000-8000-000000000001',
    'owner',
    'active'
);

insert into public.v2_children (id, family_id, display_name)
values (
    '35000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000001',
    'Ephemeral expert contract child'
);

insert into public.v2_protected_devices (
    id,
    child_id,
    installation_id,
    app_version,
    status
) values (
    '45000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000001',
    '55000000-0000-4000-8000-000000000001',
    '2.0.0-test',
    'active'
);

do $$
declare
    receipt_columns text[];
    hardened_rpc_count integer;
    service_only_rpc_count integer;
begin
    if not exists (
        select 1
        from pg_class relation
        where relation.oid = 'public.v2_ephemeral_incident_receipts'::regclass
          and relation.relrowsecurity
          and relation.relforcerowsecurity
    ) then
        raise exception 'Ephemeral receipts must have forced RLS';
    end if;

    if has_table_privilege(
        'anon',
        'public.v2_ephemeral_incident_receipts',
        'SELECT'
    ) or has_table_privilege(
        'authenticated',
        'public.v2_ephemeral_incident_receipts',
        'SELECT'
    ) then
        raise exception 'Client roles can select internal ephemeral receipts';
    end if;

    select array_agg(column_name::text order by ordinal_position)
      into receipt_columns
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'v2_ephemeral_incident_receipts';

    if receipt_columns is distinct from array[
        'incident_id',
        'submission_hash',
        'privacy_identity_version',
        'key_version',
        'message_count',
        'context_expires_at',
        'state',
        'lease_token_hash',
        'lease_expires_at',
        'completion_request_hash',
        'completion_lease_token_hash',
        'completion_incident_status',
        'completion_analysis_outcome',
        'completion_delivery_count',
        'completed_at',
        'created_at',
        'updated_at'
    ]::text[] then
        raise exception 'Ephemeral receipts contain an unexpected persistence field';
    end if;

    select count(*)::integer
      into hardened_rpc_count
      from pg_proc procedure
     where procedure.oid in (
        'public.v2_begin_ephemeral_incident_analysis_service(uuid,uuid,text,text,text,real,real,timestamptz,smallint,smallint,bigint,integer,smallint,timestamptz,text,integer)'::regprocedure,
        'public.v2_release_ephemeral_incident_analysis_service(uuid,text)'::regprocedure,
        'public.v2_finalize_ephemeral_incident_analysis_service(uuid,text,text,text,text,text,text,text[],text,text,text,text,real,text[],text[])'::regprocedure
     )
       and procedure.prosecdef
       and exists (
            select 1
            from unnest(procedure.proconfig) setting
            where setting = 'search_path=""'
       );

    if hardened_rpc_count <> 3 then
        raise exception 'Ephemeral RPC security-definer search-path contract failed';
    end if;

    select count(*)::integer
      into service_only_rpc_count
      from pg_proc procedure
     where procedure.oid in (
        'public.v2_begin_ephemeral_incident_analysis_service(uuid,uuid,text,text,text,real,real,timestamptz,smallint,smallint,bigint,integer,smallint,timestamptz,text,integer)'::regprocedure,
        'public.v2_release_ephemeral_incident_analysis_service(uuid,text)'::regprocedure,
        'public.v2_finalize_ephemeral_incident_analysis_service(uuid,text,text,text,text,text,text,text[],text,text,text,text,real,text[],text[])'::regprocedure
     )
       and has_function_privilege('service_role', procedure.oid, 'EXECUTE')
       and not has_function_privilege('anon', procedure.oid, 'EXECUTE')
       and not has_function_privilege('authenticated', procedure.oid, 'EXECUTE');

    if service_only_rpc_count <> 3 then
        raise exception 'Ephemeral RPC execute grants are not service-role only';
    end if;
end
$$;

set local role service_role;

do $$
declare
    first_result record;
    busy_result record;
    retry_result record;
    final_result record;
    final_replay_result record;
    released boolean;
    wrong_lease_token text;
begin
    select * into first_result
    from public.v2_begin_ephemeral_incident_analysis_service(
        '45000000-0000-4000-8000-000000000001',
        '75000000-0000-4000-8000-000000000001',
        'exclusion',
        'high',
        'target',
        0.9::real,
        0.95::real,
        date_trunc('milliseconds', now() - interval '1 minute'),
        2::smallint,
        3::smallint,
        7::bigint,
        1::integer,
        2::smallint,
        date_trunc('milliseconds', now() + interval '1 day'),
        repeat('ab', 32),
        120::integer
    );

    if first_result.incident_id is null
       or first_result.created is not true
       or first_result.analysis_state is distinct from 'leased'
       or char_length(first_result.lease_token) is distinct from 64 then
        raise exception 'Ephemeral begin did not create a valid lease';
    end if;

    wrong_lease_token :=
        case left(first_result.lease_token, 1)
            when '0' then '1'
            else '0'
        end || substr(first_result.lease_token, 2);

    begin
        perform *
        from public.v2_begin_ephemeral_incident_analysis_service(
            '45000000-0000-4000-8000-000000000001',
            '75000000-0000-4000-8000-000000000001',
            'exclusion',
            'high',
            'target',
            0.9::real,
            0.95::real,
            date_trunc('milliseconds', now() - interval '1 minute'),
            2::smallint,
            3::smallint,
            7::bigint,
            1::integer,
            2::smallint,
            date_trunc('milliseconds', now() + interval '1 day'),
            repeat('cd', 32),
            120::integer
        );
        raise exception 'Expected begin idempotency conflict';
    exception
        when unique_violation then
            if sqlerrm <> 'incident_idempotency_conflict' then
                raise;
            end if;
    end;

    select * into busy_result
    from public.v2_begin_ephemeral_incident_analysis_service(
        '45000000-0000-4000-8000-000000000001',
        '75000000-0000-4000-8000-000000000001',
        'exclusion',
        'high',
        'target',
        0.9::real,
        0.95::real,
        date_trunc('milliseconds', now() - interval '1 minute'),
        2::smallint,
        3::smallint,
        7::bigint,
        1::integer,
        2::smallint,
        date_trunc('milliseconds', now() + interval '1 day'),
        repeat('ab', 32),
        120::integer
    );

    if public.v2_release_ephemeral_incident_analysis_service(
        first_result.incident_id,
        wrong_lease_token
    ) then
        raise exception 'Wrong-token release was accepted';
    end if;

    released := public.v2_release_ephemeral_incident_analysis_service(
        first_result.incident_id,
        first_result.lease_token
    );

    select * into retry_result
    from public.v2_begin_ephemeral_incident_analysis_service(
        '45000000-0000-4000-8000-000000000001',
        '75000000-0000-4000-8000-000000000001',
        'exclusion',
        'high',
        'target',
        0.9::real,
        0.95::real,
        date_trunc('milliseconds', now() - interval '1 minute'),
        2::smallint,
        3::smallint,
        7::bigint,
        1::integer,
        2::smallint,
        date_trunc('milliseconds', now() + interval '1 day'),
        repeat('ab', 32),
        120::integer
    );

    begin
        perform *
        from public.v2_finalize_ephemeral_incident_analysis_service(
            retry_result.incident_id,
            wrong_lease_token,
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
        raise exception 'Expected wrong-token finalize rejection';
    exception
        when insufficient_privilege then
            if sqlerrm <> 'invalid_or_expired_analysis_lease' then
                raise;
            end if;
    end;

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

    select * into final_replay_result
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

    if final_replay_result.incident_status is distinct from final_result.incident_status
       or final_replay_result.analysis_outcome is distinct from final_result.analysis_outcome
       or final_replay_result.delivery_count is distinct from final_result.delivery_count then
        raise exception 'Finalize replay did not return the original result';
    end if;

    begin
        perform *
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
            'isolated',
            0.91::real,
            array['AAAAAAAAAAAAAAAAAAAAAA']::text[],
            array['in_app', 'push']::text[]
        );
        raise exception 'Expected finalize payload conflict';
    exception
        when unique_violation then
            if sqlerrm <> 'incident_analysis_completion_conflict' then
                raise;
            end if;
    end;

    begin
        perform *
        from public.v2_finalize_ephemeral_incident_analysis_service(
            retry_result.incident_id,
            wrong_lease_token,
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
        raise exception 'Expected completed wrong-token finalize rejection';
    exception
        when insufficient_privilege then
            if sqlerrm <> 'invalid_or_expired_analysis_lease' then
                raise;
            end if;
    end;

    if busy_result.incident_id is distinct from first_result.incident_id
       or busy_result.created is not false
       or busy_result.analysis_state is distinct from 'busy'
       or busy_result.lease_token is not null
       or released is not true
       or retry_result.incident_id is distinct from first_result.incident_id
       or retry_result.created is not false
       or retry_result.analysis_state is distinct from 'leased'
       or char_length(retry_result.lease_token) is distinct from 64
       or retry_result.lease_token is not distinct from first_result.lease_token
       or final_result.analysis_outcome is distinct from 'confirmed'
       or final_result.delivery_count is distinct from 2 then
        raise exception 'Ephemeral lease lifecycle failed';
    end if;

    perform set_config(
        'test.ephemeral_incident_id',
        first_result.incident_id::text,
        true
    );
end
$$;

reset role;

do $$
declare
    target_incident_id uuid;
    delivery_total integer;
begin
    target_incident_id := nullif(
        current_setting('test.ephemeral_incident_id', true),
        ''
    )::uuid;

    if target_incident_id is null then
        raise exception 'Ephemeral lifecycle did not expose its synthetic incident ID';
    end if;

    if not exists (
        select 1 from public.v2_ephemeral_incident_receipts receipt
        where receipt.incident_id = target_incident_id
          and receipt.submission_hash = decode(repeat('ab', 32), 'hex')
          and receipt.state = 'completed'
          and receipt.lease_token_hash is null
          and receipt.lease_expires_at is null
          and octet_length(receipt.completion_request_hash) = 32
          and octet_length(receipt.completion_lease_token_hash) = 32
    ) then
        raise exception 'Content-free completed V3 receipt is missing';
    end if;

    if not exists (
        select 1 from public.v2_incident_analysis analysis
        where analysis.incident_id = target_incident_id
          and analysis.outcome = 'confirmed'
          and analysis.safe_summary is not null
          and analysis.safe_reason is not null
          and analysis.recommended_action is not null
          and analysis.prompt_version = 'kippy-expert-v4'
    ) then
        raise exception 'Parent-safe analysis and guidance were not persisted';
    end if;

    if not exists (
        select 1 from public.v2_incident_analysis_details details
        where details.incident_id = target_incident_id
          and details.expert_category = 'exclusion'
          and details.inference_contract_version = 3
          and details.evidence_segment_refs =
                array['AAAAAAAAAAAAAAAAAAAAAA']::text[]
    ) then
        raise exception 'Structured expert result was not persisted';
    end if;

    select count(*)::integer into delivery_total
    from public.v2_alert_deliveries delivery
    where delivery.incident_id = target_incident_id;

    if delivery_total is distinct from 2 then
        raise exception 'Expected in-app and push alert intents, found %',
            delivery_total;
    end if;

    if exists (
        select 1 from public.v2_incident_context context
        where context.incident_id = target_incident_id
    ) then
        raise exception 'Raw context was persisted for a V3 incident';
    end if;

    if exists (
        select 1 from public.v2_incident_analysis_jobs job
        where job.incident_id = target_incident_id
    ) then
        raise exception 'V3 incident entered the stored-context worker';
    end if;
end
$$;

set local role authenticated;
select set_config(
    'request.jwt.claim.sub',
    '15000000-0000-4000-8000-000000000001',
    true
);

do $$
begin
    if has_table_privilege(
        'anon',
        'public.v2_ephemeral_incident_receipts',
        'SELECT'
    ) or has_table_privilege(
        'authenticated',
        'public.v2_ephemeral_incident_receipts',
        'SELECT'
    ) then
        raise exception 'Client role can select internal ephemeral receipts';
    end if;
end
$$;

reset role;

rollback;
