begin;

-- Retire the browser/API surface without deleting historical data or schema.
-- The canonical CEO Assistant migration defines eight functions (six exposed
-- RPCs and two internal guards); there is no ninth CEO function in the
-- canonical migration history, so this migration does not guess a target.
do $retire_control_tower$
declare
    target_signature text;
    target_function regprocedure;
    target_signatures constant text[] := array[
        -- CT-R0 read RPCs (11).
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

        -- Helpers used only by the retired read surface (3).
        'public.v2_admin_can_read_case(uuid,text)',
        'public.v2_admin_denied_response(uuid,uuid,text,uuid,text,text,text[])',
        'public.v2_admin_field_envelope(jsonb,text,timestamptz,timestamptz,timestamptz,text,text,text,text,text)',

        -- CEO Assistant functions present in canonical history (8).
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
            raise exception 'missing_control_tower_retirement_target: %',
                target_signature;
        end if;

        execute format(
            'revoke all privileges on function %s from public, anon, authenticated, service_role',
            target_function
        );
    end loop;
end
$retire_control_tower$;

commit;
