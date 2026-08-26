begin;

create table public.v2_pairing_sessions (
    id uuid primary key default gen_random_uuid(),
    child_id uuid not null references public.v2_children(id) on delete cascade,
    created_by uuid not null references auth.users(id) on delete cascade,
    code_hash text not null check (char_length(code_hash) = 64),
    expires_at timestamptz not null,
    attempts smallint not null default 0 check (attempts between 0 and 5),
    max_attempts smallint not null default 5 check (max_attempts between 1 and 5),
    consumed_at timestamptz,
    created_at timestamptz not null default now(),
    check (expires_at > created_at),
    check (expires_at <= created_at + interval '15 minutes')
);

create index v2_pairing_sessions_child_open
    on public.v2_pairing_sessions(child_id, expires_at desc)
    where consumed_at is null;

create table public.v2_incident_encryption_keys (
    key_version integer primary key check (key_version > 0),
    algorithm text not null
        check (algorithm = 'RSA-OAEP-3072-SHA256+AES-256-GCM'),
    public_key_pem text not null
        check (
            ltrim(public_key_pem, E' \n\r\t')
                like '-----BEGIN PUBLIC KEY-----%'
            and public_key_pem not like '%PRIVATE%'
        ),
    status text not null check (status in ('active', 'retired')),
    activates_at timestamptz not null default now(),
    retires_at timestamptz,
    created_at timestamptz not null default now(),
    check (retires_at is null or retires_at > activates_at)
);

create unique index v2_one_active_incident_encryption_key
    on public.v2_incident_encryption_keys((status))
    where status = 'active';

insert into public.v2_incident_encryption_keys (
    key_version,
    algorithm,
    public_key_pem,
    status
)
values (
    1,
    'RSA-OAEP-3072-SHA256+AES-256-GCM',
    $public_key$
-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEA1c6UWrSksQ8/qXZMe/qY
mg7S76Y4He5pleO9gF+krvDzzqSiTpukG2gqCquu1XGpczs2/+r9ws1scPM1QAzK
3y+pbCmBUKhBKUk/Sgf0NLcgbPEqQSINos/XFkcEg/MhXvhpYPxRDuOM2EQDz/QH
/bhkY/B4Lwh4z0jOz0KeOMm/rsEQBbd3UUk15POPpo4FzcS8TmgajESNokxroO3r
vG5ypubbYnMk4VGWr6dR26XSEWl29bPpywxvHLMCV+CdXwwYPoB2bIMWL8XmXjC/
8gdGpTlLSvgJcw4EWfjVGgi4bGiMxD8BO5vJnl0UHFLGfNeWV3z/7okmHtDck6II
7PFsyi6msoPZwzSeCi2i2N74wpSxGwuAS7uuChPER9c29kauQroxNG4mbYzngiqN
htGIT7Aq0ZivT8pNI1apgvxdBC8q7CQn+AP19ku891pJBqgzZQd5KLqkuCUfEUi7
4tFdfFuQmplwyLdfiWeXGEaTaxcxz6OxKtfAMV8gviK3AgMBAAE=
-----END PUBLIC KEY-----
$public_key$,
    'active'
);

create or replace function public.v2_create_pairing_session_service(
    actor_user_id uuid,
    target_pairing_id uuid,
    target_child_id uuid,
    new_code_hash text,
    target_expires_at timestamptz
)
returns table (
    pairing_id uuid,
    expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    target_family_id uuid;
    created_pairing_id uuid;
begin
    if actor_user_id is null
       or target_pairing_id is null
       or target_child_id is null
       or char_length(new_code_hash) <> 64
       or target_expires_at <= now()
       or target_expires_at > now() + interval '10 minutes' then
        raise exception 'invalid_pairing_request'
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

    update public.v2_pairing_sessions pairing
       set consumed_at = now()
     where pairing.child_id = target_child_id
       and pairing.consumed_at is null;

    insert into public.v2_pairing_sessions (
        id,
        child_id,
        created_by,
        code_hash,
        expires_at
    )
    values (
        target_pairing_id,
        target_child_id,
        actor_user_id,
        new_code_hash,
        target_expires_at
    )
    returning id into created_pairing_id;

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
        'v2.pairing.create',
        'pairing_session',
        created_pairing_id,
        'success'
    );

    return query select created_pairing_id, target_expires_at;
end;
$$;

create or replace function public.v2_complete_pairing_service(
    target_pairing_id uuid,
    supplied_code_hash text,
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
    credential_key_version integer,
    credential_expiry timestamptz,
    child_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    pairing public.v2_pairing_sessions%rowtype;
    registered_device_id uuid;
    registered_key_version integer;
    registered_expiry timestamptz;
begin
    select *
      into pairing
      from public.v2_pairing_sessions session
     where session.id = target_pairing_id
     for update;

    if pairing.id is null
       or pairing.consumed_at is not null
       or pairing.expires_at <= now()
       or pairing.attempts >= pairing.max_attempts then
        return;
    end if;

    if pairing.code_hash <> supplied_code_hash then
        update public.v2_pairing_sessions
           set attempts = least(attempts + 1, max_attempts)
         where id = pairing.id;
        return;
    end if;

    select registration.device_id,
           registration.credential_key_version,
           registration.credential_expiry
      into registered_device_id,
           registered_key_version,
           registered_expiry
      from public.v2_register_device_service(
          pairing.created_by,
          pairing.child_id,
          target_installation_id,
          target_app_version,
          target_capture_contract_version,
          target_manufacturer,
          target_model,
          new_credential_hash,
          credential_expires_at
      ) registration;

    update public.v2_pairing_sessions
       set consumed_at = now()
     where id = pairing.id;

    insert into public.v2_audit_events (
        actor_type,
        action,
        object_type,
        object_id,
        outcome
    )
    values (
        'device',
        'v2.pairing.complete',
        'protected_device',
        registered_device_id,
        'success'
    );

    return query
    select
        registered_device_id,
        registered_key_version,
        registered_expiry,
        pairing.child_id;
end;
$$;

create or replace function public.v2_get_active_incident_encryption_key_service()
returns table (
    key_version integer,
    algorithm text,
    public_key_pem text
)
language sql
stable
security definer
set search_path = ''
as $$
    select key.key_version, key.algorithm, key.public_key_pem
      from public.v2_incident_encryption_keys key
     where key.status = 'active'
       and key.activates_at <= now()
       and (key.retires_at is null or key.retires_at > now())
     limit 1;
$$;

alter table public.v2_pairing_sessions enable row level security;
alter table public.v2_pairing_sessions force row level security;
alter table public.v2_incident_encryption_keys enable row level security;
alter table public.v2_incident_encryption_keys force row level security;

revoke all on table
    public.v2_pairing_sessions,
    public.v2_incident_encryption_keys
from anon, authenticated;

revoke all on function public.v2_create_pairing_session_service(
    uuid, uuid, uuid, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.v2_complete_pairing_service(
    uuid, text, uuid, text, smallint, text, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.v2_get_active_incident_encryption_key_service()
from public, anon, authenticated;

grant execute on function public.v2_create_pairing_session_service(
    uuid, uuid, uuid, text, timestamptz
) to service_role;
grant execute on function public.v2_complete_pairing_service(
    uuid, text, uuid, text, smallint, text, text, text, timestamptz
) to service_role;
grant execute on function public.v2_get_active_incident_encryption_key_service()
to service_role;

commit;
