begin;

create or replace function public.v2_set_guardian_incident_state(
    target_incident_id uuid,
    target_state text,
    target_request_key text
)
returns table (
    incident_id uuid,
    guardian_user_id uuid,
    state text,
    saved_at timestamptz,
    acknowledged_at timestamptz,
    updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    resolved public.v2_guardian_incident_states%rowtype;
begin
    if actor is null then
        raise exception 'guardian_authentication_required'
            using errcode = '42501';
    end if;

    if target_incident_id is null
       or target_state not in ('new', 'saved', 'acknowledged')
       or target_request_key is null
       or char_length(btrim(target_request_key)) not between 16 and 200 then
        raise exception 'invalid_guardian_incident_state'
            using errcode = '22023';
    end if;

    if not public.v2_guardian_can_read_confirmed_incident(
        target_incident_id
    ) then
        raise exception 'guardian_incident_access_denied'
            using errcode = '42501';
    end if;

    insert into public.v2_guardian_incident_states (
        incident_id,
        guardian_user_id,
        state,
        saved_at,
        acknowledged_at
    )
    values (
        target_incident_id,
        actor,
        target_state,
        case when target_state = 'saved' then now() end,
        case when target_state = 'acknowledged' then now() end
    )
    on conflict on constraint v2_guardian_incident_states_pkey
    do update
       set state = excluded.state,
           saved_at = case
               when excluded.state = 'new' then null
               when excluded.state = 'saved' then
                   coalesce(
                       public.v2_guardian_incident_states.saved_at,
                       now()
                   )
               else public.v2_guardian_incident_states.saved_at
           end,
           acknowledged_at = case
               when excluded.state = 'acknowledged' then
                   coalesce(
                       public.v2_guardian_incident_states.acknowledged_at,
                       now()
                   )
               else null
           end
    returning * into resolved;

    insert into public.v2_audit_events (
        actor_user_id,
        actor_type,
        action,
        object_type,
        object_id,
        outcome,
        metadata
    )
    values (
        actor,
        'guardian',
        'v2.guardian.incident_state.set',
        'safety_incident',
        target_incident_id,
        'success',
        jsonb_build_object(
            'state', target_state,
            'request_key', btrim(target_request_key),
            'contract_version', 1
        )
    );

    return query
    select
        resolved.incident_id,
        resolved.guardian_user_id,
        resolved.state,
        resolved.saved_at,
        resolved.acknowledged_at,
        resolved.updated_at;
end;
$$;

revoke all on function
    public.v2_set_guardian_incident_state(uuid, text, text)
from public, anon, authenticated, service_role;

grant execute on function
    public.v2_set_guardian_incident_state(uuid, text, text)
to authenticated;

commit;
