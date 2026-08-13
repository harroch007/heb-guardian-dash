begin;

create table public.v2_guardian_profiles (
    user_id uuid primary key
        references auth.users(id) on delete cascade,
    display_name text not null check (
        char_length(display_name) between 2 and 120
    ),
    phone text check (
        phone is null
        or (
            char_length(phone) between 7 and 32
            and phone ~ '^[0-9+() .-]+$'
        )
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger v2_guardian_profiles_set_updated_at
before update on public.v2_guardian_profiles
for each row execute function public.v2_set_updated_at();

alter table public.v2_guardian_profiles enable row level security;
alter table public.v2_guardian_profiles force row level security;

create policy v2_guardians_read_own_profile
on public.v2_guardian_profiles for select
to authenticated
using (user_id = auth.uid());

revoke all on table public.v2_guardian_profiles
from anon, authenticated;
grant select on table public.v2_guardian_profiles
to authenticated;

create or replace function public.v2_bootstrap_guardian(
    target_family_id uuid,
    target_display_name text,
    target_phone text,
    target_request_key text
)
returns table (
    family_id uuid,
    created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    clean_name text := nullif(btrim(target_display_name), '');
    clean_phone text := nullif(btrim(target_phone), '');
    existing_family_id uuid;
begin
    if actor is null then
        raise exception 'guardian_not_authenticated'
            using errcode = '42501';
    end if;
    perform public.v2_require_parental_request_key_service(
        target_request_key
    );
    if target_family_id is null
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

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(actor::text, 0)
    );

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
           phone = excluded.phone;

    select membership.family_id
      into existing_family_id
      from public.v2_guardian_memberships membership
      join public.v2_families family
        on family.id = membership.family_id
     where membership.guardian_user_id = actor
       and membership.status = 'active'
       and family.status = 'active'
     order by
        case when membership.role = 'owner' then 0 else 1 end,
        membership.created_at,
        membership.id
     limit 1;

    if existing_family_id is not null then
        return query select existing_family_id, false;
        return;
    end if;

    insert into public.v2_families (
        id,
        display_name
    )
    values (
        target_family_id,
        clean_name
    );

    insert into public.v2_guardian_memberships (
        family_id,
        guardian_user_id,
        role,
        status
    )
    values (
        target_family_id,
        actor,
        'owner',
        'active'
    );

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
        'v2.guardian.bootstrap',
        'family',
        target_family_id,
        'success',
        jsonb_build_object('request_key', target_request_key)
    );

    return query select target_family_id, true;
end;
$$;

create or replace function public.v2_create_guardian_child(
    target_child_id uuid,
    target_family_id uuid,
    target_display_name text,
    target_birth_year smallint,
    target_request_key text
)
returns table (
    child_id uuid,
    family_id uuid,
    display_name text,
    birth_year smallint,
    status text,
    created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    clean_name text := nullif(btrim(target_display_name), '');
    inserted_count integer;
    child_row public.v2_children%rowtype;
begin
    if actor is null
       or not public.v2_is_family_guardian(target_family_id) then
        raise exception 'guardian_not_authorized'
            using errcode = '42501';
    end if;
    perform public.v2_require_parental_request_key_service(
        target_request_key
    );
    if target_child_id is null
       or clean_name is null
       or char_length(clean_name) not between 1 and 120
       or (
           target_birth_year is not null
           and target_birth_year not between 2000 and 2100
       ) then
        raise exception 'invalid_child'
            using errcode = '22023';
    end if;

    insert into public.v2_children (
        id,
        family_id,
        display_name,
        birth_year
    )
    values (
        target_child_id,
        target_family_id,
        clean_name,
        target_birth_year
    )
    on conflict (id) do nothing;
    get diagnostics inserted_count = row_count;

    select child.*
      into child_row
      from public.v2_children child
     where child.id = target_child_id;
    if child_row.id is null
       or child_row.family_id <> target_family_id
       or child_row.display_name <> clean_name
       or child_row.birth_year is distinct from target_birth_year then
        raise exception 'child_request_conflict'
            using errcode = '23505';
    end if;

    insert into public.v2_parental_settings (
        child_id,
        revision,
        updated_by
    )
    values (
        target_child_id,
        0,
        actor
    )
    on conflict (child_id) do nothing;

    if inserted_count = 1 then
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
            'v2.guardian.child.create',
            'child',
            target_child_id,
            'success',
            jsonb_build_object(
                'family_id',
                target_family_id,
                'request_key',
                target_request_key
            )
        );
    end if;

    return query
    select
        child_row.id,
        child_row.family_id,
        child_row.display_name,
        child_row.birth_year,
        child_row.status,
        inserted_count = 1;
end;
$$;

revoke all on function public.v2_bootstrap_guardian(
    uuid,
    text,
    text,
    text
) from public, anon;
grant execute on function public.v2_bootstrap_guardian(
    uuid,
    text,
    text,
    text
) to authenticated;

revoke all on function public.v2_create_guardian_child(
    uuid,
    uuid,
    text,
    smallint,
    text
) from public, anon;
grant execute on function public.v2_create_guardian_child(
    uuid,
    uuid,
    text,
    smallint,
    text
) to authenticated;

commit;
