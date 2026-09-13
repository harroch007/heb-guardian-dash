create table public.v2_guardian_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.v2_families(id) on delete cascade,
  invited_by uuid not null,
  invited_email text not null,
  invited_name text not null,
  code_hash text not null,
  code_expires_at timestamptz not null,
  receive_alerts boolean not null default false,
  status text not null default 'pending',
  attempt_count smallint not null default 0,
  accepted_at timestamptz,
  accepted_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_guardian_invites_status_check
    check (status in ('pending','accepted','cancelled','expired'))
);

create index v2_guardian_invites_family_idx on public.v2_guardian_invites(family_id);
create unique index v2_guardian_invites_pending_email_idx
  on public.v2_guardian_invites(family_id, lower(invited_email))
  where status = 'pending';

grant select on public.v2_guardian_invites to authenticated;
grant all on public.v2_guardian_invites to service_role;

alter table public.v2_guardian_invites enable row level security;

create policy "guardians read family invites"
on public.v2_guardian_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.v2_guardian_memberships m
    where m.family_id = v2_guardian_invites.family_id
      and m.guardian_user_id = auth.uid()
      and m.status = 'active'
  )
);

create or replace function public.v2_touch_guardian_invite()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger v2_guardian_invites_touch
before update on public.v2_guardian_invites
for each row execute function public.v2_touch_guardian_invite();

-- helper: 6 digit code
create or replace function public.v2_generate_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select lpad((floor(random() * 1000000))::int::text, 6, '0');
$$;

create or replace function public.v2_hash_invite_code(target_invite_id uuid, supplied_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(
    extensions.digest(target_invite_id::text || ':' || supplied_code, 'sha256'),
    'hex'
  );
$$;

-- create invite
create or replace function public.v2_create_guardian_invite(
  target_email text,
  target_name text,
  target_receive_alerts boolean default false
)
returns table (
  invite_id uuid,
  invite_code text,
  invited_email text,
  invited_name text,
  code_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_family uuid;
  new_id uuid := gen_random_uuid();
  new_code text := public.v2_generate_invite_code();
  clean_email text := lower(btrim(target_email));
  clean_name text := btrim(target_name);
  expiry timestamptz := now() + interval '7 days';
begin
  if actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if clean_name = '' or char_length(clean_name) > 80 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;

  select m.family_id into actor_family
  from public.v2_guardian_memberships m
  where m.guardian_user_id = actor
    and m.status = 'active'
    and m.role = 'owner'
  order by m.created_at
  limit 1;

  if actor_family is null then
    raise exception 'guardian_not_authorized' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.v2_guardian_memberships m
    join auth.users u on u.id = m.guardian_user_id
    where m.family_id = actor_family
      and m.status = 'active'
      and lower(u.email) = clean_email
  ) then
    raise exception 'already_member' using errcode = '23505';
  end if;

  update public.v2_guardian_invites
     set status = 'cancelled'
   where family_id = actor_family
     and status = 'pending'
     and lower(invited_email) = clean_email;

  insert into public.v2_guardian_invites (
    id, family_id, invited_by, invited_email, invited_name,
    code_hash, code_expires_at, receive_alerts
  ) values (
    new_id, actor_family, actor, clean_email, clean_name,
    public.v2_hash_invite_code(new_id, new_code), expiry, coalesce(target_receive_alerts, false)
  );

  return query select new_id, new_code, clean_email, clean_name, expiry;
end;
$$;

-- regenerate code
create or replace function public.v2_regenerate_guardian_invite_code(
  target_invite_id uuid
)
returns table (invite_code text, code_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  new_code text := public.v2_generate_invite_code();
  expiry timestamptz := now() + interval '7 days';
  updated integer;
begin
  if actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  update public.v2_guardian_invites i
     set code_hash = public.v2_hash_invite_code(i.id, new_code),
         code_expires_at = expiry,
         attempt_count = 0,
         status = 'pending'
   where i.id = target_invite_id
     and i.status in ('pending','expired')
     and exists (
       select 1 from public.v2_guardian_memberships m
       where m.family_id = i.family_id
         and m.guardian_user_id = actor
         and m.status = 'active'
         and m.role = 'owner'
     );

  get diagnostics updated = row_count;
  if updated = 0 then
    raise exception 'invite_not_found' using errcode = '42501';
  end if;

  return query select new_code, expiry;
end;
$$;

-- cancel invite
create or replace function public.v2_cancel_guardian_invite(target_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  updated integer;
begin
  if actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  update public.v2_guardian_invites i
     set status = 'cancelled'
   where i.id = target_invite_id
     and i.status = 'pending'
     and exists (
       select 1 from public.v2_guardian_memberships m
       where m.family_id = i.family_id
         and m.guardian_user_id = actor
         and m.status = 'active'
         and m.role = 'owner'
     );
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

-- service lookup used by the join edge function
create or replace function public.v2_lookup_guardian_invite_service(
  supplied_email text,
  supplied_code text
)
returns table (invite_id uuid, invited_email text, invited_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_row public.v2_guardian_invites%rowtype;
  clean_email text := lower(btrim(supplied_email));
begin
  select * into found_row
  from public.v2_guardian_invites i
  where lower(i.invited_email) = clean_email
    and i.status = 'pending'
  order by i.created_at desc
  limit 1
  for update;

  if found_row.id is null then
    return;
  end if;

  if found_row.code_expires_at <= now() then
    update public.v2_guardian_invites set status = 'expired' where id = found_row.id;
    return;
  end if;

  if found_row.attempt_count >= 8 then
    return;
  end if;

  if found_row.code_hash <> public.v2_hash_invite_code(found_row.id, btrim(supplied_code)) then
    update public.v2_guardian_invites
       set attempt_count = attempt_count + 1
     where id = found_row.id;
    return;
  end if;

  return query select found_row.id, found_row.invited_email, found_row.invited_name;
end;
$$;

-- claim by the authenticated invitee
create or replace function public.v2_claim_guardian_invite(
  supplied_code text
)
returns table (family_id uuid, already_member boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_email text;
  found_row public.v2_guardian_invites%rowtype;
  existing uuid;
begin
  if actor is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select lower(u.email) into actor_email from auth.users u where u.id = actor;
  if actor_email is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into found_row
  from public.v2_guardian_invites i
  where lower(i.invited_email) = actor_email
    and i.status = 'pending'
  order by i.created_at desc
  limit 1
  for update;

  if found_row.id is null
     or found_row.code_expires_at <= now()
     or found_row.code_hash <> public.v2_hash_invite_code(found_row.id, btrim(supplied_code)) then
    raise exception 'invalid_invite' using errcode = '42501';
  end if;

  select m.id into existing
  from public.v2_guardian_memberships m
  where m.family_id = found_row.family_id
    and m.guardian_user_id = actor;

  if existing is null then
    insert into public.v2_guardian_memberships (
      id, family_id, guardian_user_id, role, status
    ) values (
      gen_random_uuid(), found_row.family_id, actor, 'guardian', 'active'
    );
  else
    update public.v2_guardian_memberships
       set status = 'active'
     where id = existing;
  end if;

  insert into public.v2_guardian_profiles (user_id, display_name)
  values (actor, found_row.invited_name)
  on conflict (user_id) do nothing;

  update public.v2_guardian_invites
     set status = 'accepted',
         accepted_at = now(),
         accepted_user_id = actor
   where id = found_row.id;

  return query select found_row.family_id, existing is not null;
end;
$$;

revoke all on function public.v2_lookup_guardian_invite_service(text, text) from public, anon, authenticated;
grant execute on function public.v2_lookup_guardian_invite_service(text, text) to service_role;

grant execute on function public.v2_create_guardian_invite(text, text, boolean) to authenticated;
grant execute on function public.v2_regenerate_guardian_invite_code(uuid) to authenticated;
grant execute on function public.v2_cancel_guardian_invite(uuid) to authenticated;
grant execute on function public.v2_claim_guardian_invite(text) to authenticated;

notify pgrst, 'reload schema';