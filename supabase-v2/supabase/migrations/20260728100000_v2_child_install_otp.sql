begin;

create table public.v2_child_install_sessions (
    id uuid primary key,
    child_id uuid not null
        references public.v2_children(id) on delete cascade,
    created_by uuid not null
        references auth.users(id) on delete cascade,
    activation_token_hash text not null unique
        check (char_length(activation_token_hash) = 64),
    status text not null default 'created'
        check (status in (
            'created', 'activated', 'consumed', 'cancelled', 'expired'
        )),
    otp_request_count smallint not null default 0
        check (otp_request_count between 0 and 3),
    otp_requested_at timestamptz,
    activated_at timestamptz,
    consumed_at timestamptz,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (expires_at > created_at),
    check (expires_at <= created_at + interval '30 minutes'),
    check (
        (status = 'created' and activated_at is null and consumed_at is null)
        or
        (status = 'activated' and activated_at is not null and consumed_at is null)
        or
        (status = 'consumed' and activated_at is not null and consumed_at is not null)
        or
        (status in ('cancelled', 'expired') and consumed_at is null)
    )
);

create unique index v2_one_open_child_install_per_guardian
    on public.v2_child_install_sessions(created_by)
    where status in ('created', 'activated');

create unique index v2_one_open_child_install_per_child
    on public.v2_child_install_sessions(child_id)
    where status in ('created', 'activated');

create index v2_child_install_expiry
    on public.v2_child_install_sessions(expires_at)
    where status in ('created', 'activated');

create trigger v2_child_install_sessions_set_updated_at
before update on public.v2_child_install_sessions
for each row execute function public.v2_set_updated_at();

create or replace function public.v2_create_child_install_session_service(
    actor_user_id uuid,
    target_session_id uuid,
    target_child_id uuid,
    new_activation_token_hash text,
    target_expires_at timestamptz
)
returns table (
    install_session_id uuid,
    expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    target_family_id uuid;
begin
    if actor_user_id is null
       or target_session_id is null
       or target_child_id is null
       or char_length(new_activation_token_hash) <> 64
       or target_expires_at <= now()
       or target_expires_at > now() + interval '30 minutes' then
        raise exception 'invalid_child_install_request'
            using errcode = '22023';
    end if;

    select child.family_id
      into target_family_id
      from public.v2_children child
     where child.id = target_child_id
       and child.status = 'active';

    if target_family_id is null or not exists (
        select 1
          from public.v2_guardian_memberships membership
         where membership.family_id = target_family_id
           and membership.guardian_user_id = actor_user_id
           and membership.status = 'active'
    ) then
        raise exception 'guardian_not_authorized'
            using errcode = '42501';
    end if;

    update public.v2_child_install_sessions session
       set status = case
               when session.expires_at <= now() then 'expired'
               else 'cancelled'
           end
     where (
            session.created_by = actor_user_id
            or session.child_id = target_child_id
       )
       and session.status in ('created', 'activated');

    insert into public.v2_child_install_sessions (
        id,
        child_id,
        created_by,
        activation_token_hash,
        expires_at
    )
    values (
        target_session_id,
        target_child_id,
        actor_user_id,
        new_activation_token_hash,
        target_expires_at
    );

    insert into public.v2_audit_events (
        actor_user_id,
        actor_type,
        action,
        object_type,
        object_id,
        outcome
    )
    values (
        actor_user_id,
        'guardian',
        'v2.child_install.create',
        'child_install_session',
        target_session_id,
        'success'
    );

    return query select target_session_id, target_expires_at;
end;
$$;

create or replace function public.v2_activate_child_install_session_service(
    supplied_activation_token_hash text
)
returns table (
    install_session_id uuid,
    guardian_user_id uuid,
    should_send_otp boolean,
    expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    session public.v2_child_install_sessions%rowtype;
    send_otp boolean;
begin
    if char_length(supplied_activation_token_hash) <> 64 then
        return;
    end if;

    select *
      into session
      from public.v2_child_install_sessions install
     where install.activation_token_hash = supplied_activation_token_hash
     for update;

    if session.id is null
       or session.status not in ('created', 'activated') then
        return;
    end if;

    if session.expires_at <= now() then
        update public.v2_child_install_sessions
           set status = 'expired'
         where id = session.id;
        return;
    end if;

    send_otp :=
        session.otp_requested_at is null
        or session.otp_requested_at <= now() - interval '60 seconds';

    if send_otp and session.otp_request_count >= 3 then
        return;
    end if;

    update public.v2_child_install_sessions
       set status = 'activated',
           activated_at = coalesce(activated_at, now()),
           otp_requested_at = case
               when send_otp then now()
               else otp_requested_at
           end,
           otp_request_count = case
               when send_otp then otp_request_count + 1
               else otp_request_count
           end
     where id = session.id;

    return query
    select
        session.id,
        session.created_by,
        send_otp,
        session.expires_at;
end;
$$;

create or replace function public.v2_complete_child_install_service(
    actor_user_id uuid,
    target_installation_id uuid,
    target_app_version text,
    target_capture_contract_version smallint,
    target_manufacturer text,
    target_model text,
    new_credential_hash text,
    credential_expires_at timestamptz
)
returns table (
    device_id uuid,
    child_id uuid,
    credential_key_version integer,
    credential_expiry timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    session public.v2_child_install_sessions%rowtype;
    registered_device_id uuid;
    registered_key_version integer;
    registered_expiry timestamptz;
begin
    select *
      into session
      from public.v2_child_install_sessions install
     where install.created_by = actor_user_id
       and install.status = 'activated'
     order by install.activated_at desc
     limit 1
     for update;

    if session.id is null or session.expires_at <= now() then
        if session.id is not null then
            update public.v2_child_install_sessions
               set status = 'expired'
             where id = session.id;
        end if;
        return;
    end if;

    select registration.device_id,
           registration.credential_key_version,
           registration.credential_expiry
      into registered_device_id,
           registered_key_version,
           registered_expiry
      from public.v2_register_device_service(
          actor_user_id,
          session.child_id,
          target_installation_id,
          target_app_version,
          target_capture_contract_version,
          target_manufacturer,
          target_model,
          new_credential_hash,
          credential_expires_at
      ) registration;

    if registered_device_id is null then
        return;
    end if;

    update public.v2_child_install_sessions
       set status = 'consumed',
           consumed_at = now()
     where id = session.id;

    insert into public.v2_audit_events (
        actor_user_id,
        actor_type,
        action,
        object_type,
        object_id,
        outcome
    )
    values (
        actor_user_id,
        'guardian',
        'v2.child_install.complete',
        'protected_device',
        registered_device_id,
        'success'
    );

    return query
    select
        registered_device_id,
        session.child_id,
        registered_key_version,
        registered_expiry;
end;
$$;

alter table public.v2_child_install_sessions enable row level security;
alter table public.v2_child_install_sessions force row level security;

revoke all on table public.v2_child_install_sessions
    from public, anon, authenticated;
grant all on table public.v2_child_install_sessions to service_role;

revoke all on function public.v2_create_child_install_session_service(
    uuid, uuid, uuid, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.v2_activate_child_install_session_service(text)
    from public, anon, authenticated;
revoke all on function public.v2_complete_child_install_service(
    uuid, uuid, text, smallint, text, text, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.v2_create_child_install_session_service(
    uuid, uuid, uuid, text, timestamptz
) to service_role;
grant execute on function public.v2_activate_child_install_session_service(text)
    to service_role;
grant execute on function public.v2_complete_child_install_service(
    uuid, uuid, text, smallint, text, text, text, timestamptz
) to service_role;

commit;
