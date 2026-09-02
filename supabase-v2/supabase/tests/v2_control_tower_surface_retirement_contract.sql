begin;

do $contract$
declare
    target_signature text;
    target_function regprocedure;
    role_name text;
    public_execute_grant_exists boolean;
    target_signatures constant text[] := array[
        'public.v2_admin_get_session()',
        'public.v2_admin_list_fixture_scenarios()',
        'public.v2_admin_list_inbox(text,text,text,timestamptz,uuid,integer)',
        'public.v2_admin_get_conversation(uuid)',
        'public.v2_admin_get_case(uuid)',
        'public.v2_admin_list_case_messages(uuid,timestamptz,uuid,integer)',
        'public.v2_admin_list_case_timeline(uuid,timestamptz,bigint,integer)',
        'public.v2_admin_get_service360(uuid)',
        'public.v2_admin_get_parent_safe_incident(uuid)',
        'public.v2_admin_list_case_actions(uuid)',
        'public.v2_admin_list_audit_events(uuid,timestamptz,bigint,integer)',
        'public.v2_admin_can_read_case(uuid,text)',
        'public.v2_admin_denied_response(uuid,uuid,text,uuid,text,text,text[])',
        'public.v2_admin_field_envelope(jsonb,text,timestamptz,timestamptz,timestamptz,text,text,text,text,text)',
        'public.v2_admin_ceo_path_array_is_safe(text[],integer)',
        'public.v2_admin_is_current_ceo()',
        'public.v2_admin_get_parental_controls_projection(uuid)',
        'public.v2_admin_get_executive_operational_summary()',
        'public.v2_admin_create_ceo_change_task(text,text,text,text,text[],text[],text[],boolean)',
        'public.v2_admin_list_ceo_change_tasks(integer)',
        'public.v2_admin_approve_ceo_change_task(uuid)',
        'public.v2_admin_cancel_ceo_change_task(uuid)'
    ];
begin
    if cardinality(target_signatures) <> 22 then
        raise exception 'unexpected_control_tower_retirement_target_count';
    end if;

    foreach target_signature in array target_signatures
    loop
        target_function := to_regprocedure(target_signature);
        if target_function is null then
            raise exception 'retired_function_was_dropped: %', target_signature;
        end if;

        foreach role_name in array array['anon', 'authenticated', 'service_role']
        loop
            if has_function_privilege(role_name, target_function, 'EXECUTE') then
                raise exception 'retired_function_still_executable: role=%, function=%',
                    role_name, target_signature;
            end if;
        end loop;

        select exists (
            select 1
              from pg_proc procedure
              cross join lateral aclexplode(
                  coalesce(
                      procedure.proacl,
                      acldefault('f', procedure.proowner)
                  )
              ) privilege
             where procedure.oid = target_function::oid
               and privilege.grantee = 0
               and privilege.privilege_type = 'EXECUTE'
        )
          into public_execute_grant_exists;

        if public_execute_grant_exists then
            raise exception 'retired_function_still_public: %', target_signature;
        end if;
    end loop;

    -- The excluded backend surfaces must remain present and callable by their
    -- previously authorized role. This detects accidental blanket retirement.
    if not has_function_privilege(
        'service_role',
        'public.v2_admin_claim_shadow_jobs_service(text,text,integer,integer)'::regprocedure,
        'EXECUTE'
    ) then
        raise exception 'shadow_runtime_privilege_changed';
    end if;

    if not has_function_privilege(
        'service_role',
        'public.v2_admin_ingest_whatsapp_webhook_service(text,text,text,timestamptz,jsonb)'::regprocedure,
        'EXECUTE'
    ) then
        raise exception 'whatsapp_support_privilege_changed';
    end if;

    if not has_function_privilege(
        'authenticated',
        'public.v2_cmo_list_pending_approvals(integer)'::regprocedure,
        'EXECUTE'
    ) then
        raise exception 'cmo_privilege_changed';
    end if;

    if to_regclass('public.v2_admin_cases') is null
       or to_regclass('public.v2_admin_ceo_change_tasks') is null
       or to_regclass('public.v2_admin_shadow_jobs') is null
       or to_regclass('public.v2_support_webhook_envelopes') is null
       or to_regclass('public.v2_admin_principals') is null
       or to_regclass('public.v2_staff_profiles') is null then
        raise exception 'retirement_dropped_retained_schema';
    end if;
end
$contract$;

rollback;
