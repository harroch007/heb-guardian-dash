begin;

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
    on conflict on constraint v2_parental_settings_pkey do nothing;

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

commit;
