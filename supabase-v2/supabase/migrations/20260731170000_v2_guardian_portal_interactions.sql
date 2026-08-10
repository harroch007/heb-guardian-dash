begin;

create table public.v2_guardian_incident_states (
    incident_id uuid not null
        references public.v2_safety_incidents(id) on delete cascade,
    guardian_user_id uuid not null
        references auth.users(id) on delete cascade,
    state text not null default 'new'
        check (state in ('new', 'saved', 'acknowledged')),
    saved_at timestamptz,
    acknowledged_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (incident_id, guardian_user_id)
);

comment on table public.v2_guardian_incident_states is
    'Per-guardian workflow state for confirmed, parent-safe incidents. It never stores raw child conversation content.';

create trigger v2_guardian_incident_states_set_updated_at
before update on public.v2_guardian_incident_states
for each row execute function public.v2_set_updated_at();

create index v2_guardian_incident_states_guardian_state
    on public.v2_guardian_incident_states(
        guardian_user_id,
        state,
        updated_at desc
    );

alter table public.v2_guardian_incident_states enable row level security;
alter table public.v2_guardian_incident_states force row level security;

create policy v2_guardians_read_own_incident_state
on public.v2_guardian_incident_states for select
to authenticated
using (
    guardian_user_id = auth.uid()
    and public.v2_guardian_can_read_confirmed_incident(incident_id)
);

revoke all on table public.v2_guardian_incident_states
from public, anon, authenticated;
grant select on table public.v2_guardian_incident_states
to authenticated;

create or replace function public.v2_update_guardian_profile(
    target_display_name text,
    target_phone text,
    target_request_key text
)
returns table (
    display_name text,
    phone text,
    updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    clean_name text := nullif(btrim(target_display_name), '');
    clean_phone text := nullif(btrim(target_phone), '');
    profile public.v2_guardian_profiles%rowtype;
begin
    if actor is null then
        raise exception 'guardian_authentication_required'
            using errcode = '42501';
    end if;

    if target_request_key is null
       or char_length(btrim(target_request_key)) not between 16 and 200
       or clean_name is null
       or char_length(clean_name) not between 2 and 120
       or (
           clean_phone is not null
           and (
               char_length(clean_phone) not between 7 and 32
               or clean_phone !~ '^[0-9+() .-]+$'
           )
       ) then
        raise exception 'invalid_guardian_profile'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
          from public.v2_guardian_memberships membership
         where membership.guardian_user_id = actor
           and membership.status = 'active'
    ) then
        raise exception 'active_guardian_membership_required'
            using errcode = '42501';
    end if;

    insert into public.v2_guardian_profiles (
        user_id,
        display_name,
        phone
    )
    values (
        actor,
        clean_name,
        clean_phone
    )
    on conflict (user_id) do update
       set display_name = excluded.display_name,
           phone = excluded.phone
    returning * into profile;

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
        'v2.guardian.profile.update',
        'guardian_profile',
        actor,
        'success',
        jsonb_build_object(
            'request_key', btrim(target_request_key),
            'phone_present', clean_phone is not null,
            'contract_version', 1
        )
    );

    return query
    select profile.display_name, profile.phone, profile.updated_at;
end;
$$;

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
    on conflict (incident_id, guardian_user_id) do update
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
    public.v2_update_guardian_profile(text, text, text),
    public.v2_set_guardian_incident_state(uuid, text, text)
from public, anon, authenticated, service_role;

grant execute on function
    public.v2_update_guardian_profile(text, text, text),
    public.v2_set_guardian_incident_state(uuid, text, text)
to authenticated;

commit;
