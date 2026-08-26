begin;

create or replace function public.v2_guard_incident_key_grace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.retires_at is not null
       and new.retires_at < now() + interval '7 days' then
        raise exception 'incident_key_grace_too_short'
            using errcode = '23514';
    end if;

    if new.status = 'retired'
       and new.retires_at is null then
        raise exception 'retired_incident_key_requires_expiry'
            using errcode = '23514';
    end if;

    return new;
end;
$$;

create trigger v2_incident_encryption_keys_guard_grace
before insert or update of status, retires_at
on public.v2_incident_encryption_keys
for each row execute function public.v2_guard_incident_key_grace();

drop function public.v2_get_active_incident_encryption_key_service();

create function public.v2_get_active_incident_encryption_key_service()
returns table (
    key_version integer,
    algorithm text,
    public_key_pem text,
    accepts_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        key.key_version,
        key.algorithm,
        key.public_key_pem,
        now() + interval '7 days'
    from public.v2_incident_encryption_keys key
    where key.status = 'active'
      and key.activates_at <= now()
      and (
          key.retires_at is null
          or key.retires_at >= now() + interval '7 days'
      )
    limit 1;
$$;

revoke all on function
public.v2_get_active_incident_encryption_key_service()
from public, anon, authenticated;

grant execute on function
public.v2_get_active_incident_encryption_key_service()
to service_role;

commit;
