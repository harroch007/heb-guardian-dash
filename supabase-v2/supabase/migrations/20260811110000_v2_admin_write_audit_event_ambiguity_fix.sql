begin;

-- Repair an ambiguous PL/pgSQL predicate without rewriting the applied
-- migration that originally defined this internal audit helper.
create or replace function public.v2_admin_write_audit_event(
    target_event_type text,
    target_outcome text,
    target_case_id uuid,
    target_conversation_id uuid,
    target_object_type text,
    target_object_id uuid,
    target_purpose_code text,
    target_field_keys text[],
    target_reason_code text,
    target_correlation_id uuid,
    target_safe_metadata jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor_principal_id_value uuid;
    actor_environment_value text;
    audit_event_id_value bigint;
    permission_keys_value text[];
begin
    actor_principal_id_value := public.v2_admin_current_staff_principal();
    if actor_principal_id_value is null then
        raise exception 'staff_not_authorized' using errcode = '42501';
    end if;
    if target_outcome not in ('success', 'denied', 'failed')
       or target_event_type !~ '^[a-z0-9_.:-]{2,120}$'
       or target_object_type !~ '^[a-z0-9_.:-]{2,100}$'
       or target_purpose_code !~ '^[a-z0-9_.:-]{2,100}$'
       or not public.v2_admin_json_is_safe(
           coalesce(target_safe_metadata, '{}'::jsonb),
           32768
       ) then
        raise exception 'invalid_admin_audit_event' using errcode = '22023';
    end if;

    select principal.environment
      into actor_environment_value
      from public.v2_admin_principals principal
     where principal.id = actor_principal_id_value;

    select coalesce(array_agg(distinct role_permission.permission_key), '{}')
      into permission_keys_value
      from public.v2_staff_role_assignments assignment
      join public.v2_staff_role_permissions role_permission
        on role_permission.role_key = assignment.role_key
     where assignment.staff_principal_id = actor_principal_id_value
       and assignment.environment = actor_environment_value
       and assignment.valid_from <= now()
       and (assignment.expires_at is null or assignment.expires_at > now());

    insert into public.v2_admin_audit_events (
        environment,
        event_type,
        outcome,
        actor_principal_id,
        case_id,
        conversation_id,
        purpose_code,
        permission_snapshot,
        deny_reason_code,
        object_type,
        object_id,
        requested_action,
        field_keys,
        sensitivity,
        correlation_id,
        session_id,
        version_snapshot,
        safe_metadata
    )
    values (
        actor_environment_value,
        target_event_type,
        target_outcome,
        actor_principal_id_value,
        target_case_id,
        target_conversation_id,
        target_purpose_code,
        jsonb_build_object('permission_keys', permission_keys_value),
        target_reason_code,
        target_object_type,
        target_object_id,
        target_event_type,
        coalesce(target_field_keys, '{}'),
        case
            when target_outcome = 'denied' then 'restricted'
            else 'confidential'
        end,
        coalesce(target_correlation_id, gen_random_uuid()),
        nullif(auth.jwt()->>'session_id', ''),
        '{"contract":"ct-r0-v1"}'::jsonb,
        coalesce(target_safe_metadata, '{}'::jsonb)
    )
    returning id into audit_event_id_value;

    return audit_event_id_value;
end;
$$;

revoke all on function public.v2_admin_write_audit_event(
    text, text, uuid, uuid, text, uuid, text, text[], text, uuid, jsonb
) from public, anon, authenticated, service_role;

commit;
