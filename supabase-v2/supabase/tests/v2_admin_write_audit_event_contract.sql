-- Disposable database contract only. All synthetic fixtures are rolled back.
begin;

do $$
declare
    helper_signature regprocedure :=
        'public.v2_admin_write_audit_event(text,text,uuid,uuid,text,uuid,text,text[],text,uuid,jsonb)'::regprocedure;
begin
    if not exists (
        select 1
          from pg_proc procedure
         where procedure.oid = helper_signature
           and procedure.prosecdef
           and exists (
               select 1
                 from unnest(procedure.proconfig) setting
                where setting = 'search_path=""'
           )
    ) then
        raise exception 'admin_audit_helper_security_contract_failed';
    end if;

    if has_function_privilege('anon', helper_signature, 'EXECUTE')
       or has_function_privilege('authenticated', helper_signature, 'EXECUTE')
       or has_function_privilege('service_role', helper_signature, 'EXECUTE') then
        raise exception 'admin_audit_helper_must_remain_internal_only';
    end if;

    if has_function_privilege(
        'authenticated',
        'public.v2_admin_list_fixture_scenarios()'::regprocedure,
        'EXECUTE'
    ) then
        raise exception 'retired_fixture_catalog_rpc_still_executable';
    end if;
end;
$$;

insert into auth.users (id)
values ('19000000-0000-4000-8000-000000000001');

insert into public.v2_admin_principals (
    id,
    principal_type,
    principal_key,
    display_name,
    environment,
    status
)
values (
    '29000000-0000-4000-8000-000000000001',
    'staff',
    'admin-audit-contract',
    'Admin audit contract',
    'staging',
    'active'
);

insert into public.v2_staff_profiles (principal_id, auth_user_id)
values (
    '29000000-0000-4000-8000-000000000001',
    '19000000-0000-4000-8000-000000000001'
);

insert into public.v2_staff_role_assignments (
    staff_principal_id,
    role_key,
    environment,
    scope_type,
    scope_key,
    granted_by_principal_id,
    reason_code
)
values (
    '29000000-0000-4000-8000-000000000001',
    'support_agent',
    'staging',
    'global',
    null,
    '29000000-0000-4000-8000-000000000001',
    'admin-audit-runtime-contract'
);

insert into public.v2_staff_roles (role_key, display_name, is_active)
values
    ('contract_disabled', 'Contract disabled role', false),
    ('contract_queue', 'Contract queue role', true);

insert into public.v2_staff_permissions (
    permission_key, risk_class, description
) values
    ('contract.disabled.read', 'r0_masked', 'Disabled-role audit contract permission'),
    ('contract.queue.read', 'r0_masked', 'Out-of-scope audit contract permission');

insert into public.v2_staff_role_permissions (role_key, permission_key)
values
    ('contract_disabled', 'contract.disabled.read'),
    ('contract_queue', 'contract.queue.read');

insert into public.v2_staff_role_assignments (
    staff_principal_id,
    role_key,
    environment,
    scope_type,
    scope_key,
    granted_by_principal_id,
    reason_code
)
values
    (
        '29000000-0000-4000-8000-000000000001',
        'contract_disabled',
        'staging',
        'global',
        null,
        '29000000-0000-4000-8000-000000000001',
        'admin-audit-disabled-role'
    ),
    (
        '29000000-0000-4000-8000-000000000001',
        'contract_queue',
        'staging',
        'queue',
        'unrelated-queue',
        '29000000-0000-4000-8000-000000000001',
        'admin-audit-out-of-scope'
    );

select set_config(
    'request.jwt.claim.sub',
    '19000000-0000-4000-8000-000000000001',
    true
);
select set_config(
    'request.jwt.claims',
    json_build_object(
        'sub', '19000000-0000-4000-8000-000000000001',
        'aal', 'aal2',
        'session_id', 'admin-audit-runtime-contract'
    )::text,
    true
);

do $$
declare
    audit_event_id bigint;
begin
    audit_event_id := public.v2_admin_write_audit_event(
        'contract.audit',
        'success',
        null,
        null,
        'contract_object',
        '39000000-0000-4000-8000-000000000001',
        'contract_review',
        array['contract_field'],
        null,
        '49000000-0000-4000-8000-000000000001',
        jsonb_build_object('contract', 'admin-audit-ambiguity-fix')
    );

    if audit_event_id is null or audit_event_id <= 0 then
        raise exception 'direct_admin_audit_write_returned_invalid_id';
    end if;

    perform set_config('test.admin_audit_direct_id', audit_event_id::text, true);
end;
$$;

-- The historical function remains available to its owner for schema/history
-- verification, but the browser-facing authenticated role is retired above.
do $$
declare
    response jsonb;
    audit_event_id bigint;
begin
    response := public.v2_admin_list_fixture_scenarios();

    if response->>'source_mode' is distinct from 'fixture'
       or jsonb_typeof(response->'data') is distinct from 'array'
       or jsonb_array_length(response->'data') <= 0 then
        raise exception 'fixture_catalog_rpc_returned_invalid_payload:%', response;
    end if;

    begin
        audit_event_id := (response->>'audit_event_id')::bigint;
    exception
        when invalid_text_representation or numeric_value_out_of_range then
            raise exception 'fixture_catalog_rpc_returned_invalid_audit_id:%', response;
    end;

    if audit_event_id is null or audit_event_id <= 0 then
        raise exception 'fixture_catalog_rpc_returned_invalid_audit_id:%', response;
    end if;

    perform set_config('test.admin_audit_rpc_id', audit_event_id::text, true);
end;
$$;

do $$
declare
    direct_event public.v2_admin_audit_events%rowtype;
    rpc_event public.v2_admin_audit_events%rowtype;
begin
    select *
      into strict direct_event
      from public.v2_admin_audit_events
     where id = current_setting('test.admin_audit_direct_id')::bigint;

    if direct_event.environment is distinct from 'staging'
       or direct_event.event_type is distinct from 'contract.audit'
       or direct_event.outcome is distinct from 'success'
       or direct_event.actor_principal_id is distinct from
          '29000000-0000-4000-8000-000000000001'::uuid
       or direct_event.object_type is distinct from 'contract_object'
       or direct_event.object_id is distinct from
          '39000000-0000-4000-8000-000000000001'::uuid
       or direct_event.purpose_code is distinct from 'contract_review'
       or direct_event.correlation_id is distinct from
          '49000000-0000-4000-8000-000000000001'::uuid
       or direct_event.field_keys is distinct from array['contract_field']::text[]
       or direct_event.session_id is distinct from 'admin-audit-runtime-contract'
       or direct_event.safe_metadata is distinct from
          jsonb_build_object('contract', 'admin-audit-ambiguity-fix')
       or not coalesce(
           direct_event.permission_snapshot->'permission_keys' ? 'fixture.read',
           false
       ) then
        raise exception 'direct_admin_audit_row_contract_failed';
    end if;

    if coalesce(
           direct_event.permission_snapshot->'permission_keys' ? 'contract.disabled.read',
           false
       )
       or coalesce(
           direct_event.permission_snapshot->'permission_keys' ? 'contract.queue.read',
           false
       ) then
        raise exception 'inactive_or_out_of_scope_permission_in_snapshot';
    end if;

    select *
      into strict rpc_event
      from public.v2_admin_audit_events
     where id = current_setting('test.admin_audit_rpc_id')::bigint;

    if rpc_event.environment is distinct from 'staging'
       or rpc_event.event_type is distinct from 'fixture.catalog_read'
       or rpc_event.outcome is distinct from 'success'
       or rpc_event.actor_principal_id is distinct from
          '29000000-0000-4000-8000-000000000001'::uuid
       or rpc_event.object_type is distinct from 'fixture_catalog'
       or rpc_event.purpose_code is distinct from 'fixture_review'
       or not (rpc_event.field_keys @> array['fixture_key', 'title']::text[])
       or coalesce((rpc_event.safe_metadata->>'result_count')::integer, 0) <= 0
       or not coalesce(
           rpc_event.permission_snapshot->'permission_keys' ? 'fixture.read',
           false
       ) then
        raise exception 'fixture_catalog_audit_row_contract_failed';
    end if;

    if (
        select count(*)
          from public.v2_admin_audit_events event
         where event.actor_principal_id =
               '29000000-0000-4000-8000-000000000001'::uuid
    ) <> 2 then
        raise exception 'unexpected_admin_audit_row_count';
    end if;
end;
$$;

select 'V2 admin audit ambiguity runtime contract: PASS';

rollback;
