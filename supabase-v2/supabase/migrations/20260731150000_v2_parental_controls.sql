begin;

alter table public.v2_device_commands
    add column if not exists requested_by uuid
        references auth.users(id) on delete set null,
    add column if not exists updated_at timestamptz not null default now();

alter table public.v2_device_commands
    add constraint v2_device_commands_parental_allowlist
    check (
        command_type in (
            'REPORT_HEARTBEAT',
            'REFRESH_SETTINGS',
            'LOCATE_NOW',
            'RING_DEVICE'
        )
    );

create trigger v2_device_commands_set_updated_at
before update on public.v2_device_commands
for each row execute function public.v2_set_updated_at();

create table public.v2_parental_settings (
    child_id uuid primary key
        references public.v2_children(id) on delete cascade,
    revision bigint not null default 1 check (revision > 0),
    daily_screen_time_limit_minutes smallint check (
        daily_screen_time_limit_minutes is null
        or daily_screen_time_limit_minutes between 0 and 1440
    ),
    location_tracking_enabled boolean not null default false,
    location_update_interval_minutes smallint not null default 15
        check (location_update_interval_minutes between 1 and 1440),
    home_exit_alert_enabled boolean not null default false,
    school_exit_alert_enabled boolean not null default false,
    exit_debounce_seconds smallint not null default 120
        check (exit_debounce_seconds between 30 and 3600),
    lost_mode_enabled boolean not null default false,
    lost_mode_message text check (
        lost_mode_message is null
        or char_length(lost_mode_message) between 1 and 160
    ),
    updated_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.v2_parental_app_policies (
    id uuid primary key default gen_random_uuid(),
    child_id uuid not null
        references public.v2_children(id) on delete cascade,
    package_name text not null check (
        char_length(package_name) between 3 and 255
        and package_name ~ '^[A-Za-z0-9_.]+$'
    ),
    app_name text check (
        app_name is null or char_length(app_name) between 1 and 160
    ),
    policy_status text not null
        check (policy_status in ('approved', 'blocked')),
    daily_limit_minutes smallint check (
        daily_limit_minutes is null
        or daily_limit_minutes between 0 and 1440
    ),
    always_allowed boolean not null default false,
    updated_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (child_id, package_name),
    check (not (always_allowed and policy_status = 'blocked'))
);

create index v2_parental_app_policies_child
    on public.v2_parental_app_policies(child_id, package_name);

create table public.v2_parental_schedules (
    id uuid primary key,
    child_id uuid not null
        references public.v2_children(id) on delete cascade,
    name text not null check (char_length(name) between 1 and 80),
    schedule_type text not null check (
        schedule_type in (
            'daily_recurring',
            'weekly_recurring',
            'shabbat'
        )
    ),
    days_of_week smallint[],
    start_time time,
    end_time time,
    is_active boolean not null default true,
    mode text not null default 'default'
        check (mode in ('default', 'manual')),
    updated_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (
        days_of_week is null
        or (
            cardinality(days_of_week) between 1 and 7
            and days_of_week <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
        )
    ),
    check (
        schedule_type = 'shabbat'
        or (start_time is not null and end_time is not null)
    ),
    check (
        schedule_type <> 'shabbat'
        or mode = 'default'
        or (start_time is not null and end_time is not null)
    )
);

create index v2_parental_schedules_child
    on public.v2_parental_schedules(child_id, is_active);

create table public.v2_parental_geofences (
    id uuid primary key,
    child_id uuid not null
        references public.v2_children(id) on delete cascade,
    place_type text not null default 'manual'
        check (place_type in ('home', 'school', 'manual')),
    label text check (
        label is null or char_length(label) between 1 and 80
    ),
    latitude double precision not null check (
        latitude between -90 and 90
    ),
    longitude double precision not null check (
        longitude between -180 and 180
    ),
    radius_meters smallint not null check (
        radius_meters between 50 and 5000
    ),
    is_active boolean not null default true,
    alert_on_enter boolean not null default false,
    alert_on_exit boolean not null default true,
    schedule_mode text not null default 'always'
        check (schedule_mode in ('always', 'scheduled')),
    days_of_week smallint[],
    start_time time,
    end_time time,
    updated_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (
        days_of_week is null
        or (
            cardinality(days_of_week) between 1 and 7
            and days_of_week <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
        )
    ),
    check (
        schedule_mode = 'always'
        or (
            days_of_week is not null
            and start_time is not null
            and end_time is not null
        )
    )
);

create index v2_parental_geofences_child
    on public.v2_parental_geofences(child_id, is_active);

create table public.v2_parental_bonus_grants (
    id uuid primary key default gen_random_uuid(),
    child_id uuid not null
        references public.v2_children(id) on delete cascade,
    grant_date date not null default (
        now() at time zone 'Asia/Jerusalem'
    )::date,
    bonus_minutes smallint not null check (bonus_minutes between 1 and 720),
    granted_by uuid not null references auth.users(id) on delete restrict,
    request_key text not null check (
        char_length(request_key) between 12 and 160
    ),
    created_at timestamptz not null default now(),
    unique (child_id, request_key)
);

create index v2_parental_bonus_grants_child_date
    on public.v2_parental_bonus_grants(child_id, grant_date);

create table public.v2_parental_time_requests (
    id uuid primary key,
    child_id uuid not null
        references public.v2_children(id) on delete cascade,
    device_id uuid not null
        references public.v2_protected_devices(id) on delete cascade,
    requested_minutes smallint not null
        check (requested_minutes between 1 and 240),
    reason text check (reason is null or char_length(reason) <= 240),
    status text not null default 'pending'
        check (status in ('pending', 'approved', 'denied', 'expired')),
    approved_minutes smallint check (
        approved_minutes is null
        or approved_minutes between 1 and 240
    ),
    responded_by uuid references auth.users(id) on delete set null,
    responded_at timestamptz,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    check (expires_at > created_at),
    check (
        (status = 'pending' and responded_at is null)
        or (status <> 'pending' and responded_at is not null)
    ),
    check (
        status <> 'approved' or approved_minutes is not null
    ),
    check (
        status = 'approved' or approved_minutes is null
    )
);

create index v2_parental_time_requests_child_status
    on public.v2_parental_time_requests(child_id, status, created_at desc);

create table public.v2_parental_device_state (
    device_id uuid primary key
        references public.v2_protected_devices(id) on delete cascade,
    event_key uuid not null,
    settings_revision_applied bigint not null default 0
        check (settings_revision_applied >= 0),
    usage_date date,
    total_screen_minutes smallint check (
        total_screen_minutes is null
        or total_screen_minutes between 0 and 1440
    ),
    latitude double precision check (latitude between -90 and 90),
    longitude double precision check (longitude between -180 and 180),
    location_accuracy_meters real check (
        location_accuracy_meters is null
        or location_accuracy_meters between 0 and 100000
    ),
    location_address text check (
        location_address is null
        or char_length(location_address) <= 240
    ),
    location_observed_at timestamptz,
    observed_at timestamptz not null,
    received_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (device_id, event_key),
    check (observed_at <= received_at + interval '10 minutes'),
    check (
        (latitude is null and longitude is null)
        or (latitude is not null and longitude is not null)
    )
);

create table public.v2_parental_installed_apps (
    device_id uuid not null
        references public.v2_protected_devices(id) on delete cascade,
    package_name text not null check (
        char_length(package_name) between 3 and 255
        and package_name ~ '^[A-Za-z0-9_.]+$'
    ),
    app_name text check (
        app_name is null or char_length(app_name) between 1 and 160
    ),
    is_system boolean not null default false,
    is_installed boolean not null default true,
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    primary key (device_id, package_name)
);

create table public.v2_parental_app_usage_daily (
    device_id uuid not null
        references public.v2_protected_devices(id) on delete cascade,
    usage_date date not null,
    package_name text not null check (
        char_length(package_name) between 3 and 255
        and package_name ~ '^[A-Za-z0-9_.]+$'
    ),
    app_name text check (
        app_name is null or char_length(app_name) between 1 and 160
    ),
    usage_minutes smallint not null check (usage_minutes between 0 and 1440),
    observed_at timestamptz not null,
    updated_at timestamptz not null default now(),
    primary key (device_id, usage_date, package_name)
);

create index v2_parental_app_usage_daily_date
    on public.v2_parental_app_usage_daily(device_id, usage_date);

create table public.v2_parental_blocked_attempts (
    id uuid primary key default gen_random_uuid(),
    device_id uuid not null
        references public.v2_protected_devices(id) on delete cascade,
    event_key uuid not null,
    package_name text not null check (
        char_length(package_name) between 3 and 255
        and package_name ~ '^[A-Za-z0-9_.]+$'
    ),
    app_name text check (
        app_name is null or char_length(app_name) between 1 and 160
    ),
    attempted_at timestamptz not null,
    received_at timestamptz not null default now(),
    unique (device_id, event_key),
    check (attempted_at <= received_at + interval '10 minutes')
);

create index v2_parental_blocked_attempts_device_time
    on public.v2_parental_blocked_attempts(device_id, attempted_at desc);

create trigger v2_parental_settings_set_updated_at
before update on public.v2_parental_settings
for each row execute function public.v2_set_updated_at();

create trigger v2_parental_app_policies_set_updated_at
before update on public.v2_parental_app_policies
for each row execute function public.v2_set_updated_at();

create trigger v2_parental_schedules_set_updated_at
before update on public.v2_parental_schedules
for each row execute function public.v2_set_updated_at();

create trigger v2_parental_geofences_set_updated_at
before update on public.v2_parental_geofences
for each row execute function public.v2_set_updated_at();

create trigger v2_parental_device_state_set_updated_at
before update on public.v2_parental_device_state
for each row execute function public.v2_set_updated_at();

create trigger v2_parental_app_usage_set_updated_at
before update on public.v2_parental_app_usage_daily
for each row execute function public.v2_set_updated_at();

create or replace function public.v2_is_child_guardian(
    target_child_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
          from public.v2_children child
         where child.id = target_child_id
           and child.status = 'active'
           and public.v2_is_family_guardian(child.family_id)
    );
$$;

create or replace function public.v2_is_device_guardian(
    target_device_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
          from public.v2_protected_devices device
          join public.v2_children child on child.id = device.child_id
         where device.id = target_device_id
           and device.status in ('active', 'degraded')
           and child.status = 'active'
           and public.v2_is_family_guardian(child.family_id)
    );
$$;

create or replace function public.v2_require_parental_request_key_service(
    target_request_key text
)
returns void
language plpgsql
immutable
security definer
set search_path = ''
as $$
begin
    if target_request_key is null
       or char_length(target_request_key) not between 12 and 160
       or target_request_key !~ '^[A-Za-z0-9._:-]+$' then
        raise exception 'invalid_request_key'
            using errcode = '22023';
    end if;
end;
$$;

create or replace function public.v2_bump_parental_revision_service(
    target_child_id uuid,
    target_actor uuid
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    next_revision bigint;
begin
    insert into public.v2_parental_settings (
        child_id,
        revision,
        updated_by
    )
    values (
        target_child_id,
        1,
        target_actor
    )
    on conflict (child_id) do update
       set revision = public.v2_parental_settings.revision + 1,
           updated_by = excluded.updated_by
    returning revision into next_revision;

    return next_revision;
end;
$$;

create or replace function public.v2_enqueue_refresh_for_child_service(
    target_child_id uuid,
    target_actor uuid,
    target_request_key text,
    target_revision bigint
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    inserted_count integer;
begin
    perform public.v2_require_parental_request_key_service(
        target_request_key
    );

    insert into public.v2_device_commands (
        device_id,
        command_type,
        payload,
        status,
        idempotency_key,
        not_before,
        expires_at,
        requested_by
    )
    select
        device.id,
        'REFRESH_SETTINGS',
        jsonb_build_object('settings_revision', target_revision),
        'pending',
        left(
            'settings:' || target_request_key || ':' || device.id::text,
            240
        ),
        now(),
        now() + interval '5 minutes',
        target_actor
      from public.v2_protected_devices device
     where device.child_id = target_child_id
       and device.status in ('active', 'degraded')
    on conflict (device_id, idempotency_key) do nothing;

    get diagnostics inserted_count = row_count;
    return inserted_count;
end;
$$;

create or replace function public.v2_set_screen_time_limit(
    target_child_id uuid,
    requested_minutes smallint,
    target_request_key text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    next_revision bigint;
begin
    if actor is null
       or not public.v2_is_child_guardian(target_child_id) then
        raise exception 'guardian_not_authorized'
            using errcode = '42501';
    end if;
    perform public.v2_require_parental_request_key_service(
        target_request_key
    );
    if requested_minutes is not null
       and requested_minutes not between 0 and 1440 then
        raise exception 'invalid_screen_time_limit'
            using errcode = '22023';
    end if;

    insert into public.v2_parental_settings (
        child_id,
        revision,
        daily_screen_time_limit_minutes,
        updated_by
    )
    values (
        target_child_id,
        1,
        requested_minutes,
        actor
    )
    on conflict (child_id) do update
       set revision = public.v2_parental_settings.revision + 1,
           daily_screen_time_limit_minutes =
               excluded.daily_screen_time_limit_minutes,
           updated_by = actor
    returning revision into next_revision;

    perform public.v2_enqueue_refresh_for_child_service(
        target_child_id,
        actor,
        target_request_key,
        next_revision
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
        'v2.parental.screen_time.set',
        'child',
        target_child_id,
        'success',
        jsonb_build_object('revision', next_revision)
    );

    return next_revision;
end;
$$;

create or replace function public.v2_grant_parent_bonus_time(
    target_child_id uuid,
    requested_minutes smallint,
    target_request_key text
)
returns table (
    grant_id uuid,
    settings_revision bigint,
    created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    existing_grant public.v2_parental_bonus_grants%rowtype;
    new_grant_id uuid;
    next_revision bigint;
begin
    if actor is null
       or not public.v2_is_child_guardian(target_child_id) then
        raise exception 'guardian_not_authorized'
            using errcode = '42501';
    end if;
    perform public.v2_require_parental_request_key_service(
        target_request_key
    );
    if requested_minutes not between 1 and 720 then
        raise exception 'invalid_bonus_minutes'
            using errcode = '22023';
    end if;

    select *
      into existing_grant
      from public.v2_parental_bonus_grants grant_row
     where grant_row.child_id = target_child_id
       and grant_row.request_key = target_request_key;

    if found then
        if existing_grant.bonus_minutes <> requested_minutes
           or existing_grant.granted_by <> actor then
            raise exception 'idempotency_key_conflict'
                using errcode = '23505';
        end if;
        select settings.revision
          into next_revision
          from public.v2_parental_settings settings
         where settings.child_id = target_child_id;
        return query
        select existing_grant.id, coalesce(next_revision, 0), false;
        return;
    end if;

    insert into public.v2_parental_bonus_grants (
        child_id,
        bonus_minutes,
        granted_by,
        request_key
    )
    values (
        target_child_id,
        requested_minutes,
        actor,
        target_request_key
    )
    returning id into new_grant_id;

    next_revision := public.v2_bump_parental_revision_service(
        target_child_id,
        actor
    );
    perform public.v2_enqueue_refresh_for_child_service(
        target_child_id,
        actor,
        target_request_key,
        next_revision
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
        'v2.parental.bonus_time.grant',
        'parental_bonus_grant',
        new_grant_id,
        'success',
        jsonb_build_object(
            'child_id',
            target_child_id,
            'revision',
            next_revision
        )
    );

    return query select new_grant_id, next_revision, true;
end;
$$;

create or replace function public.v2_set_parental_app_policy(
    target_child_id uuid,
    target_package_name text,
    target_app_name text,
    target_policy_status text,
    target_daily_limit_minutes smallint,
    target_always_allowed boolean,
    target_request_key text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    next_revision bigint;
    policy_id uuid;
begin
    if actor is null
       or not public.v2_is_child_guardian(target_child_id) then
        raise exception 'guardian_not_authorized'
            using errcode = '42501';
    end if;
    perform public.v2_require_parental_request_key_service(
        target_request_key
    );
    if target_package_name is null
       or char_length(target_package_name) not between 3 and 255
       or target_package_name !~ '^[A-Za-z0-9_.]+$'
       or target_policy_status not in ('approved', 'blocked')
       or (
           target_daily_limit_minutes is not null
           and target_daily_limit_minutes not between 0 and 1440
       )
       or (
           coalesce(target_always_allowed, false)
           and target_policy_status = 'blocked'
       ) then
        raise exception 'invalid_app_policy'
            using errcode = '22023';
    end if;

    insert into public.v2_parental_app_policies (
        child_id,
        package_name,
        app_name,
        policy_status,
        daily_limit_minutes,
        always_allowed,
        updated_by
    )
    values (
        target_child_id,
        target_package_name,
        nullif(left(target_app_name, 160), ''),
        target_policy_status,
        target_daily_limit_minutes,
        coalesce(target_always_allowed, false),
        actor
    )
    on conflict (child_id, package_name) do update
       set app_name = coalesce(
               excluded.app_name,
               public.v2_parental_app_policies.app_name
           ),
           policy_status = excluded.policy_status,
           daily_limit_minutes = excluded.daily_limit_minutes,
           always_allowed = excluded.always_allowed,
           updated_by = actor
    returning id into policy_id;

    next_revision := public.v2_bump_parental_revision_service(
        target_child_id,
        actor
    );
    perform public.v2_enqueue_refresh_for_child_service(
        target_child_id,
        actor,
        target_request_key,
        next_revision
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
        'v2.parental.app_policy.set',
        'parental_app_policy',
        policy_id,
        'success',
        jsonb_build_object(
            'child_id',
            target_child_id,
            'revision',
            next_revision
        )
    );

    return next_revision;
end;
$$;

create or replace function public.v2_upsert_parental_schedule(
    target_child_id uuid,
    target_schedule_id uuid,
    target_name text,
    target_schedule_type text,
    target_days_of_week smallint[],
    target_start_time time,
    target_end_time time,
    target_is_active boolean,
    target_mode text,
    target_request_key text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    next_revision bigint;
begin
    if actor is null
       or not public.v2_is_child_guardian(target_child_id) then
        raise exception 'guardian_not_authorized'
            using errcode = '42501';
    end if;
    perform public.v2_require_parental_request_key_service(
        target_request_key
    );
    if target_schedule_id is null
       or target_name is null
       or char_length(target_name) not between 1 and 80
       or target_schedule_type not in (
           'daily_recurring',
           'weekly_recurring',
           'shabbat'
       )
       or coalesce(target_mode, 'default') not in ('default', 'manual') then
        raise exception 'invalid_schedule'
            using errcode = '22023';
    end if;

    insert into public.v2_parental_schedules (
        id,
        child_id,
        name,
        schedule_type,
        days_of_week,
        start_time,
        end_time,
        is_active,
        mode,
        updated_by
    )
    values (
        target_schedule_id,
        target_child_id,
        target_name,
        target_schedule_type,
        target_days_of_week,
        target_start_time,
        target_end_time,
        coalesce(target_is_active, true),
        coalesce(target_mode, 'default'),
        actor
    )
    on conflict (id) do update
       set name = excluded.name,
           schedule_type = excluded.schedule_type,
           days_of_week = excluded.days_of_week,
           start_time = excluded.start_time,
           end_time = excluded.end_time,
           is_active = excluded.is_active,
           mode = excluded.mode,
           updated_by = actor
     where public.v2_parental_schedules.child_id = target_child_id;

    if not found then
        raise exception 'schedule_not_owned'
            using errcode = '42501';
    end if;

    next_revision := public.v2_bump_parental_revision_service(
        target_child_id,
        actor
    );
    perform public.v2_enqueue_refresh_for_child_service(
        target_child_id,
        actor,
        target_request_key,
        next_revision
    );
    return next_revision;
end;
$$;

create or replace function public.v2_delete_parental_schedule(
    target_child_id uuid,
    target_schedule_id uuid,
    target_request_key text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    deleted_count integer;
    next_revision bigint;
begin
    if actor is null
       or not public.v2_is_child_guardian(target_child_id) then
        raise exception 'guardian_not_authorized'
            using errcode = '42501';
    end if;
    perform public.v2_require_parental_request_key_service(
        target_request_key
    );

    delete from public.v2_parental_schedules schedule
     where schedule.id = target_schedule_id
       and schedule.child_id = target_child_id;
    get diagnostics deleted_count = row_count;
    if deleted_count <> 1 then
        raise exception 'schedule_not_found'
            using errcode = 'P0002';
    end if;

    next_revision := public.v2_bump_parental_revision_service(
        target_child_id,
        actor
    );
    perform public.v2_enqueue_refresh_for_child_service(
        target_child_id,
        actor,
        target_request_key,
        next_revision
    );
    return next_revision;
end;
$$;

create or replace function public.v2_upsert_parental_geofence(
    target_child_id uuid,
    target_geofence_id uuid,
    target_place_type text,
    target_label text,
    target_latitude double precision,
    target_longitude double precision,
    target_radius_meters smallint,
    target_is_active boolean,
    target_alert_on_enter boolean,
    target_alert_on_exit boolean,
    target_schedule_mode text,
    target_days_of_week smallint[],
    target_start_time time,
    target_end_time time,
    target_request_key text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    next_revision bigint;
begin
    if actor is null
       or not public.v2_is_child_guardian(target_child_id) then
        raise exception 'guardian_not_authorized'
            using errcode = '42501';
    end if;
    perform public.v2_require_parental_request_key_service(
        target_request_key
    );
    if target_geofence_id is null
       or target_place_type not in ('home', 'school', 'manual')
       or target_latitude not between -90 and 90
       or target_longitude not between -180 and 180
       or target_radius_meters not between 50 and 5000
       or target_schedule_mode not in ('always', 'scheduled') then
        raise exception 'invalid_geofence'
            using errcode = '22023';
    end if;

    insert into public.v2_parental_geofences (
        id,
        child_id,
        place_type,
        label,
        latitude,
        longitude,
        radius_meters,
        is_active,
        alert_on_enter,
        alert_on_exit,
        schedule_mode,
        days_of_week,
        start_time,
        end_time,
        updated_by
    )
    values (
        target_geofence_id,
        target_child_id,
        target_place_type,
        nullif(left(target_label, 80), ''),
        target_latitude,
        target_longitude,
        target_radius_meters,
        coalesce(target_is_active, true),
        coalesce(target_alert_on_enter, false),
        coalesce(target_alert_on_exit, true),
        target_schedule_mode,
        target_days_of_week,
        target_start_time,
        target_end_time,
        actor
    )
    on conflict (id) do update
       set place_type = excluded.place_type,
           label = excluded.label,
           latitude = excluded.latitude,
           longitude = excluded.longitude,
           radius_meters = excluded.radius_meters,
           is_active = excluded.is_active,
           alert_on_enter = excluded.alert_on_enter,
           alert_on_exit = excluded.alert_on_exit,
           schedule_mode = excluded.schedule_mode,
           days_of_week = excluded.days_of_week,
           start_time = excluded.start_time,
           end_time = excluded.end_time,
           updated_by = actor
     where public.v2_parental_geofences.child_id = target_child_id;

    if not found then
        raise exception 'geofence_not_owned'
            using errcode = '42501';
    end if;

    next_revision := public.v2_bump_parental_revision_service(
        target_child_id,
        actor
    );
    perform public.v2_enqueue_refresh_for_child_service(
        target_child_id,
        actor,
        target_request_key,
        next_revision
    );
    return next_revision;
end;
$$;

create or replace function public.v2_delete_parental_geofence(
    target_child_id uuid,
    target_geofence_id uuid,
    target_request_key text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    deleted_count integer;
    next_revision bigint;
begin
    if actor is null
       or not public.v2_is_child_guardian(target_child_id) then
        raise exception 'guardian_not_authorized'
            using errcode = '42501';
    end if;
    perform public.v2_require_parental_request_key_service(
        target_request_key
    );

    delete from public.v2_parental_geofences geofence
     where geofence.id = target_geofence_id
       and geofence.child_id = target_child_id;
    get diagnostics deleted_count = row_count;
    if deleted_count <> 1 then
        raise exception 'geofence_not_found'
            using errcode = 'P0002';
    end if;

    next_revision := public.v2_bump_parental_revision_service(
        target_child_id,
        actor
    );
    perform public.v2_enqueue_refresh_for_child_service(
        target_child_id,
        actor,
        target_request_key,
        next_revision
    );
    return next_revision;
end;
$$;

create or replace function public.v2_set_lost_mode(
    target_child_id uuid,
    target_enabled boolean,
    target_message text,
    target_request_key text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    next_revision bigint;
begin
    if actor is null
       or not public.v2_is_child_guardian(target_child_id) then
        raise exception 'guardian_not_authorized'
            using errcode = '42501';
    end if;
    perform public.v2_require_parental_request_key_service(
        target_request_key
    );
    if target_enabled is null
       or (
           target_message is not null
           and char_length(target_message) not between 1 and 160
       ) then
        raise exception 'invalid_lost_mode'
            using errcode = '22023';
    end if;

    insert into public.v2_parental_settings (
        child_id,
        revision,
        lost_mode_enabled,
        lost_mode_message,
        updated_by
    )
    values (
        target_child_id,
        1,
        target_enabled,
        case when target_enabled then target_message else null end,
        actor
    )
    on conflict (child_id) do update
       set revision = public.v2_parental_settings.revision + 1,
           lost_mode_enabled = excluded.lost_mode_enabled,
           lost_mode_message = excluded.lost_mode_message,
           updated_by = actor
    returning revision into next_revision;

    perform public.v2_enqueue_refresh_for_child_service(
        target_child_id,
        actor,
        target_request_key,
        next_revision
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
        'v2.parental.lost_mode.set',
        'child',
        target_child_id,
        'success',
        jsonb_build_object(
            'enabled',
            target_enabled,
            'revision',
            next_revision
        )
    );
    return next_revision;
end;
$$;

create or replace function public.v2_request_parental_command(
    target_device_id uuid,
    target_command_type text,
    target_payload jsonb,
    target_request_key text,
    requested_ttl_seconds integer default 120
)
returns table (
    id uuid,
    command_type text,
    status text,
    expires_at timestamptz,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    bounded_ttl integer;
begin
    if actor is null
       or not public.v2_is_device_guardian(target_device_id) then
        raise exception 'guardian_not_authorized'
            using errcode = '42501';
    end if;
    perform public.v2_require_parental_request_key_service(
        target_request_key
    );
    if target_command_type not in (
        'REPORT_HEARTBEAT',
        'REFRESH_SETTINGS',
        'LOCATE_NOW',
        'RING_DEVICE'
    ) then
        raise exception 'command_not_allowed'
            using errcode = '22023';
    end if;
    if target_payload is null
       or jsonb_typeof(target_payload) <> 'object'
       or octet_length(target_payload::text) > 2048 then
        raise exception 'invalid_command_payload'
            using errcode = '22023';
    end if;

    bounded_ttl := greatest(
        30,
        least(coalesce(requested_ttl_seconds, 120), 900)
    );

    return query
    insert into public.v2_device_commands (
        device_id,
        command_type,
        payload,
        status,
        idempotency_key,
        not_before,
        expires_at,
        requested_by
    )
    values (
        target_device_id,
        target_command_type,
        target_payload,
        'pending',
        target_request_key,
        now(),
        now() + make_interval(secs => bounded_ttl),
        actor
    )
    on conflict (device_id, idempotency_key) do update
       set idempotency_key = excluded.idempotency_key
     where public.v2_device_commands.command_type =
               excluded.command_type
       and public.v2_device_commands.payload = excluded.payload
    returning
        public.v2_device_commands.id,
        public.v2_device_commands.command_type,
        public.v2_device_commands.status,
        public.v2_device_commands.expires_at,
        public.v2_device_commands.created_at;

    if not found then
        raise exception 'idempotency_key_conflict'
            using errcode = '23505';
    end if;

    insert into public.v2_audit_events (
        actor_user_id,
        actor_type,
        action,
        object_type,
        object_id,
        outcome,
        metadata
    )
    select
        actor,
        'guardian',
        'v2.parental.command.request',
        'protected_device',
        target_device_id,
        'success',
        jsonb_build_object(
            'command_type',
            target_command_type,
            'request_key',
            target_request_key
        )
    where not exists (
        select 1
          from public.v2_audit_events audit
         where audit.actor_user_id = actor
           and audit.action = 'v2.parental.command.request'
           and audit.object_id = target_device_id
           and audit.metadata->>'request_key' = target_request_key
    );
end;
$$;

create or replace function public.v2_respond_parental_time_request(
    target_request_id uuid,
    target_approved boolean,
    target_approved_minutes smallint,
    target_request_key text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    target_child_id uuid;
    next_revision bigint;
begin
    perform public.v2_require_parental_request_key_service(
        target_request_key
    );
    select request.child_id
      into target_child_id
      from public.v2_parental_time_requests request
     where request.id = target_request_id
       and request.status = 'pending'
       and request.expires_at > now()
     for update;

    if target_child_id is null
       or actor is null
       or not public.v2_is_child_guardian(target_child_id) then
        raise exception 'time_request_not_available'
            using errcode = '42501';
    end if;
    if target_approved
       and target_approved_minutes not between 1 and 240 then
        raise exception 'invalid_approved_minutes'
            using errcode = '22023';
    end if;

    update public.v2_parental_time_requests request
       set status = case when target_approved then 'approved' else 'denied' end,
           approved_minutes =
               case when target_approved then target_approved_minutes end,
           responded_by = actor,
           responded_at = now()
     where request.id = target_request_id;

    if target_approved then
        insert into public.v2_parental_bonus_grants (
            child_id,
            bonus_minutes,
            granted_by,
            request_key
        )
        values (
            target_child_id,
            target_approved_minutes,
            actor,
            'time-request:' || target_request_id::text
        )
        on conflict (child_id, request_key) do nothing;
    end if;

    next_revision := public.v2_bump_parental_revision_service(
        target_child_id,
        actor
    );
    perform public.v2_enqueue_refresh_for_child_service(
        target_child_id,
        actor,
        target_request_key,
        next_revision
    );
    return next_revision;
end;
$$;

create or replace function public.v2_parental_settings_snapshot_service(
    target_device_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    target_child_id uuid;
    settings_row public.v2_parental_settings%rowtype;
    bonus_total integer;
    policies jsonb;
    schedules jsonb;
    geofences jsonb;
    request_updates jsonb;
begin
    select device.child_id
      into target_child_id
      from public.v2_protected_devices device
     where device.id = target_device_id
       and device.status in ('active', 'degraded');
    if target_child_id is null then
        raise exception 'device_not_active'
            using errcode = '42501';
    end if;

    select *
      into settings_row
      from public.v2_parental_settings settings
     where settings.child_id = target_child_id;

    select coalesce(sum(grant_row.bonus_minutes), 0)
      into bonus_total
      from public.v2_parental_bonus_grants grant_row
     where grant_row.child_id = target_child_id
       and grant_row.grant_date = (
           now() at time zone 'Asia/Jerusalem'
       )::date;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'package_name',
                policy.package_name,
                'app_name',
                policy.app_name,
                'policy_status',
                policy.policy_status,
                'daily_limit_minutes',
                policy.daily_limit_minutes,
                'always_allowed',
                policy.always_allowed
            )
            order by policy.package_name
        ),
        '[]'::jsonb
    )
      into policies
      from public.v2_parental_app_policies policy
     where policy.child_id = target_child_id;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id',
                schedule.id,
                'name',
                schedule.name,
                'schedule_type',
                schedule.schedule_type,
                'days_of_week',
                schedule.days_of_week,
                'start_time',
                schedule.start_time,
                'end_time',
                schedule.end_time,
                'is_active',
                schedule.is_active,
                'mode',
                schedule.mode
            )
            order by schedule.created_at, schedule.id
        ),
        '[]'::jsonb
    )
      into schedules
      from public.v2_parental_schedules schedule
     where schedule.child_id = target_child_id;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id',
                geofence.id,
                'place_type',
                geofence.place_type,
                'label',
                geofence.label,
                'latitude',
                geofence.latitude,
                'longitude',
                geofence.longitude,
                'radius_meters',
                geofence.radius_meters,
                'is_active',
                geofence.is_active,
                'alert_on_enter',
                geofence.alert_on_enter,
                'alert_on_exit',
                geofence.alert_on_exit,
                'schedule_mode',
                geofence.schedule_mode,
                'days_of_week',
                geofence.days_of_week,
                'start_time',
                geofence.start_time,
                'end_time',
                geofence.end_time
            )
            order by geofence.created_at, geofence.id
        ),
        '[]'::jsonb
    )
      into geofences
      from public.v2_parental_geofences geofence
     where geofence.child_id = target_child_id;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'request_id',
                request.id,
                'status',
                request.status,
                'approved_minutes',
                request.approved_minutes,
                'responded_at',
                request.responded_at
            )
            order by request.created_at
        ),
        '[]'::jsonb
    )
      into request_updates
      from public.v2_parental_time_requests request
     where request.child_id = target_child_id
       and request.device_id = target_device_id
       and request.created_at >= now() - interval '30 days';

    return jsonb_build_object(
        'contract_version',
        1,
        'settings_revision',
        coalesce(settings_row.revision, 0),
        'daily_screen_time_limit_minutes',
        settings_row.daily_screen_time_limit_minutes,
        'effective_screen_time_limit_minutes',
        case
            when settings_row.daily_screen_time_limit_minutes is null
                then null
            else settings_row.daily_screen_time_limit_minutes + bonus_total
        end,
        'bonus_minutes_today',
        bonus_total,
        'blocked_apps',
        (
            select coalesce(
                jsonb_agg(value->>'package_name'),
                '[]'::jsonb
            )
              from jsonb_array_elements(policies) value
             where value->>'policy_status' = 'blocked'
        ),
        'app_policies',
        policies,
        'schedule_windows',
        schedules,
        'geofence_places',
        geofences,
        'geofence_settings',
        jsonb_build_object(
            'home_exit_alert_enabled',
            coalesce(settings_row.home_exit_alert_enabled, false),
            'school_exit_alert_enabled',
            coalesce(settings_row.school_exit_alert_enabled, false),
            'exit_debounce_seconds',
            coalesce(settings_row.exit_debounce_seconds, 120)
        ),
        'time_request_updates',
        request_updates,
        'location_tracking_enabled',
        coalesce(settings_row.location_tracking_enabled, false),
        'location_update_interval_minutes',
        coalesce(settings_row.location_update_interval_minutes, 15),
        'lost_mode',
        jsonb_build_object(
            'enabled',
            coalesce(settings_row.lost_mode_enabled, false),
            'message',
            settings_row.lost_mode_message
        )
    );
end;
$$;

create or replace function public.v2_create_parental_time_request_service(
    target_device_id uuid,
    target_request_id uuid,
    requested_minutes smallint,
    target_reason text,
    target_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    target_child_id uuid;
    inserted_count integer;
begin
    if target_request_id is null
       or requested_minutes not between 1 and 240
       or target_expires_at <= now()
       or target_expires_at > now() + interval '24 hours'
       or (
           target_reason is not null
           and char_length(target_reason) > 240
       ) then
        raise exception 'invalid_time_request'
            using errcode = '22023';
    end if;

    select device.child_id
      into target_child_id
      from public.v2_protected_devices device
     where device.id = target_device_id
       and device.status in ('active', 'degraded');
    if target_child_id is null then
        raise exception 'device_not_active'
            using errcode = '42501';
    end if;

    insert into public.v2_parental_time_requests (
        id,
        child_id,
        device_id,
        requested_minutes,
        reason,
        expires_at
    )
    values (
        target_request_id,
        target_child_id,
        target_device_id,
        requested_minutes,
        target_reason,
        target_expires_at
    )
    on conflict (id) do nothing;
    get diagnostics inserted_count = row_count;
    return inserted_count = 1;
end;
$$;

create or replace function public.v2_report_parental_state_service(
    target_device_id uuid,
    target_event_key uuid,
    target_settings_revision bigint,
    target_usage_date date,
    target_total_screen_minutes smallint,
    target_latitude double precision,
    target_longitude double precision,
    target_location_accuracy_meters real,
    target_location_address text,
    target_location_observed_at timestamptz,
    target_observed_at timestamptz,
    target_installed_apps jsonb,
    target_app_usage jsonb,
    target_blocked_attempts jsonb
)
returns table (
    accepted boolean,
    affects_current_state boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    existing_event uuid;
    app_item jsonb;
    usage_item jsonb;
    attempt_item jsonb;
    current_state_changed boolean := false;
    changed_count integer := 0;
begin
    if target_event_key is null
       or target_settings_revision < 0
       or target_observed_at > now() + interval '10 minutes'
       or target_observed_at < now() - interval '7 days'
       or target_installed_apps is null
       or jsonb_typeof(target_installed_apps) <> 'array'
       or jsonb_array_length(target_installed_apps) > 500
       or target_app_usage is null
       or jsonb_typeof(target_app_usage) <> 'array'
       or jsonb_array_length(target_app_usage) > 500
       or target_blocked_attempts is null
       or jsonb_typeof(target_blocked_attempts) <> 'array'
       or jsonb_array_length(target_blocked_attempts) > 100 then
        raise exception 'invalid_parental_state'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
          from public.v2_protected_devices device
         where device.id = target_device_id
           and device.status in ('active', 'degraded')
    ) then
        raise exception 'device_not_active'
            using errcode = '42501';
    end if;

    select state.event_key
      into existing_event
      from public.v2_parental_device_state state
     where state.device_id = target_device_id
       and state.event_key = target_event_key;
    if existing_event is not null then
        return query select false, false;
        return;
    end if;

    insert into public.v2_parental_device_state (
        device_id,
        event_key,
        settings_revision_applied,
        usage_date,
        total_screen_minutes,
        latitude,
        longitude,
        location_accuracy_meters,
        location_address,
        location_observed_at,
        observed_at
    )
    values (
        target_device_id,
        target_event_key,
        target_settings_revision,
        target_usage_date,
        target_total_screen_minutes,
        target_latitude,
        target_longitude,
        target_location_accuracy_meters,
        nullif(left(target_location_address, 240), ''),
        target_location_observed_at,
        target_observed_at
    )
    on conflict (device_id) do update
       set event_key = excluded.event_key,
           settings_revision_applied =
               excluded.settings_revision_applied,
           usage_date = excluded.usage_date,
           total_screen_minutes = excluded.total_screen_minutes,
           latitude = excluded.latitude,
           longitude = excluded.longitude,
           location_accuracy_meters =
               excluded.location_accuracy_meters,
           location_address = excluded.location_address,
           location_observed_at = excluded.location_observed_at,
           observed_at = excluded.observed_at,
           received_at = now()
     where excluded.observed_at >=
               public.v2_parental_device_state.observed_at;
    get diagnostics changed_count = row_count;
    current_state_changed := changed_count = 1;

    if not current_state_changed then
        return query select true, false;
        return;
    end if;

    update public.v2_parental_installed_apps installed
       set is_installed = false
     where installed.device_id = target_device_id;

    for app_item in
        select value from jsonb_array_elements(target_installed_apps)
    loop
        if app_item->>'package_name' is null
           or char_length(app_item->>'package_name') not between 3 and 255
           or (app_item->>'package_name') !~ '^[A-Za-z0-9_.]+$' then
            raise exception 'invalid_installed_app'
                using errcode = '22023';
        end if;
        insert into public.v2_parental_installed_apps (
            device_id,
            package_name,
            app_name,
            is_system,
            is_installed,
            last_seen_at
        )
        values (
            target_device_id,
            app_item->>'package_name',
            nullif(left(app_item->>'app_name', 160), ''),
            coalesce((app_item->>'is_system')::boolean, false),
            true,
            target_observed_at
        )
        on conflict (device_id, package_name) do update
           set app_name = coalesce(
                   excluded.app_name,
                   public.v2_parental_installed_apps.app_name
               ),
               is_system = excluded.is_system,
               is_installed = true,
               last_seen_at = excluded.last_seen_at;
    end loop;

    for usage_item in
        select value from jsonb_array_elements(target_app_usage)
    loop
        if usage_item->>'package_name' is null
           or char_length(usage_item->>'package_name') not between 3 and 255
           or (usage_item->>'package_name') !~ '^[A-Za-z0-9_.]+$'
           or coalesce((usage_item->>'usage_minutes')::integer, -1)
               not between 0 and 1440 then
            raise exception 'invalid_app_usage'
                using errcode = '22023';
        end if;
        insert into public.v2_parental_app_usage_daily (
            device_id,
            usage_date,
            package_name,
            app_name,
            usage_minutes,
            observed_at
        )
        values (
            target_device_id,
            coalesce(
                (usage_item->>'usage_date')::date,
                target_usage_date
            ),
            usage_item->>'package_name',
            nullif(left(usage_item->>'app_name', 160), ''),
            (usage_item->>'usage_minutes')::smallint,
            target_observed_at
        )
        on conflict (device_id, usage_date, package_name) do update
           set app_name = coalesce(
                   excluded.app_name,
                   public.v2_parental_app_usage_daily.app_name
               ),
               usage_minutes = excluded.usage_minutes,
               observed_at = excluded.observed_at;
    end loop;

    for attempt_item in
        select value from jsonb_array_elements(target_blocked_attempts)
    loop
        if attempt_item->>'event_key' is null
           or attempt_item->>'package_name' is null
           or char_length(attempt_item->>'package_name') not between 3 and 255
           or (attempt_item->>'package_name') !~ '^[A-Za-z0-9_.]+$' then
            raise exception 'invalid_blocked_attempt'
                using errcode = '22023';
        end if;
        insert into public.v2_parental_blocked_attempts (
            device_id,
            event_key,
            package_name,
            app_name,
            attempted_at
        )
        values (
            target_device_id,
            (attempt_item->>'event_key')::uuid,
            attempt_item->>'package_name',
            nullif(left(attempt_item->>'app_name', 160), ''),
            coalesce(
                (attempt_item->>'attempted_at')::timestamptz,
                target_observed_at
            )
        )
        on conflict (device_id, event_key) do nothing;
    end loop;

    return query select true, current_state_changed;
end;
$$;

alter table public.v2_parental_settings enable row level security;
alter table public.v2_parental_settings force row level security;
alter table public.v2_parental_app_policies enable row level security;
alter table public.v2_parental_app_policies force row level security;
alter table public.v2_parental_schedules enable row level security;
alter table public.v2_parental_schedules force row level security;
alter table public.v2_parental_geofences enable row level security;
alter table public.v2_parental_geofences force row level security;
alter table public.v2_parental_bonus_grants enable row level security;
alter table public.v2_parental_bonus_grants force row level security;
alter table public.v2_parental_time_requests enable row level security;
alter table public.v2_parental_time_requests force row level security;
alter table public.v2_parental_device_state enable row level security;
alter table public.v2_parental_device_state force row level security;
alter table public.v2_parental_installed_apps enable row level security;
alter table public.v2_parental_installed_apps force row level security;
alter table public.v2_parental_app_usage_daily enable row level security;
alter table public.v2_parental_app_usage_daily force row level security;
alter table public.v2_parental_blocked_attempts enable row level security;
alter table public.v2_parental_blocked_attempts force row level security;

create policy v2_guardians_read_parental_settings
on public.v2_parental_settings for select
to authenticated
using (public.v2_is_child_guardian(child_id));

create policy v2_guardians_read_parental_app_policies
on public.v2_parental_app_policies for select
to authenticated
using (public.v2_is_child_guardian(child_id));

create policy v2_guardians_read_parental_schedules
on public.v2_parental_schedules for select
to authenticated
using (public.v2_is_child_guardian(child_id));

create policy v2_guardians_read_parental_geofences
on public.v2_parental_geofences for select
to authenticated
using (public.v2_is_child_guardian(child_id));

create policy v2_guardians_read_parental_bonus_grants
on public.v2_parental_bonus_grants for select
to authenticated
using (public.v2_is_child_guardian(child_id));

create policy v2_guardians_read_parental_time_requests
on public.v2_parental_time_requests for select
to authenticated
using (public.v2_is_child_guardian(child_id));

create policy v2_guardians_read_parental_device_state
on public.v2_parental_device_state for select
to authenticated
using (public.v2_is_device_guardian(device_id));

create policy v2_guardians_read_parental_installed_apps
on public.v2_parental_installed_apps for select
to authenticated
using (public.v2_is_device_guardian(device_id));

create policy v2_guardians_read_parental_app_usage
on public.v2_parental_app_usage_daily for select
to authenticated
using (public.v2_is_device_guardian(device_id));

create policy v2_guardians_read_parental_blocked_attempts
on public.v2_parental_blocked_attempts for select
to authenticated
using (public.v2_is_device_guardian(device_id));

create policy v2_guardians_read_parental_commands
on public.v2_device_commands for select
to authenticated
using (public.v2_is_device_guardian(device_id));

revoke all on table
    public.v2_parental_settings,
    public.v2_parental_app_policies,
    public.v2_parental_schedules,
    public.v2_parental_geofences,
    public.v2_parental_bonus_grants,
    public.v2_parental_time_requests,
    public.v2_parental_device_state,
    public.v2_parental_installed_apps,
    public.v2_parental_app_usage_daily,
    public.v2_parental_blocked_attempts
from anon, authenticated;

grant select on table
    public.v2_parental_settings,
    public.v2_parental_app_policies,
    public.v2_parental_schedules,
    public.v2_parental_geofences,
    public.v2_parental_bonus_grants,
    public.v2_parental_time_requests,
    public.v2_parental_device_state,
    public.v2_parental_installed_apps,
    public.v2_parental_app_usage_daily,
    public.v2_parental_blocked_attempts,
    public.v2_device_commands
to authenticated;

revoke all on function public.v2_is_child_guardian(uuid) from public;
revoke all on function public.v2_is_device_guardian(uuid) from public;
grant execute on function public.v2_is_child_guardian(uuid)
to authenticated;
grant execute on function public.v2_is_device_guardian(uuid)
to authenticated;

revoke all on function
    public.v2_require_parental_request_key_service(text),
    public.v2_bump_parental_revision_service(uuid, uuid),
    public.v2_enqueue_refresh_for_child_service(
        uuid,
        uuid,
        text,
        bigint
    ),
    public.v2_parental_settings_snapshot_service(uuid),
    public.v2_create_parental_time_request_service(
        uuid,
        uuid,
        smallint,
        text,
        timestamptz
    ),
    public.v2_report_parental_state_service(
        uuid,
        uuid,
        bigint,
        date,
        smallint,
        double precision,
        double precision,
        real,
        text,
        timestamptz,
        timestamptz,
        jsonb,
        jsonb,
        jsonb
    )
from public, anon, authenticated;

grant execute on function
    public.v2_require_parental_request_key_service(text),
    public.v2_bump_parental_revision_service(uuid, uuid),
    public.v2_enqueue_refresh_for_child_service(
        uuid,
        uuid,
        text,
        bigint
    ),
    public.v2_parental_settings_snapshot_service(uuid),
    public.v2_create_parental_time_request_service(
        uuid,
        uuid,
        smallint,
        text,
        timestamptz
    ),
    public.v2_report_parental_state_service(
        uuid,
        uuid,
        bigint,
        date,
        smallint,
        double precision,
        double precision,
        real,
        text,
        timestamptz,
        timestamptz,
        jsonb,
        jsonb,
        jsonb
    )
to service_role;

revoke all on function
    public.v2_set_screen_time_limit(uuid, smallint, text),
    public.v2_grant_parent_bonus_time(uuid, smallint, text),
    public.v2_set_parental_app_policy(
        uuid,
        text,
        text,
        text,
        smallint,
        boolean,
        text
    ),
    public.v2_upsert_parental_schedule(
        uuid,
        uuid,
        text,
        text,
        smallint[],
        time,
        time,
        boolean,
        text,
        text
    ),
    public.v2_delete_parental_schedule(uuid, uuid, text),
    public.v2_upsert_parental_geofence(
        uuid,
        uuid,
        text,
        text,
        double precision,
        double precision,
        smallint,
        boolean,
        boolean,
        boolean,
        text,
        smallint[],
        time,
        time,
        text
    ),
    public.v2_delete_parental_geofence(uuid, uuid, text),
    public.v2_set_lost_mode(uuid, boolean, text, text),
    public.v2_request_parental_command(
        uuid,
        text,
        jsonb,
        text,
        integer
    ),
    public.v2_respond_parental_time_request(
        uuid,
        boolean,
        smallint,
        text
    )
from public, anon;

grant execute on function
    public.v2_set_screen_time_limit(uuid, smallint, text),
    public.v2_grant_parent_bonus_time(uuid, smallint, text),
    public.v2_set_parental_app_policy(
        uuid,
        text,
        text,
        text,
        smallint,
        boolean,
        text
    ),
    public.v2_upsert_parental_schedule(
        uuid,
        uuid,
        text,
        text,
        smallint[],
        time,
        time,
        boolean,
        text,
        text
    ),
    public.v2_delete_parental_schedule(uuid, uuid, text),
    public.v2_upsert_parental_geofence(
        uuid,
        uuid,
        text,
        text,
        double precision,
        double precision,
        smallint,
        boolean,
        boolean,
        boolean,
        text,
        smallint[],
        time,
        time,
        text
    ),
    public.v2_delete_parental_geofence(uuid, uuid, text),
    public.v2_set_lost_mode(uuid, boolean, text, text),
    public.v2_request_parental_command(
        uuid,
        text,
        jsonb,
        text,
        integer
    ),
    public.v2_respond_parental_time_request(
        uuid,
        boolean,
        smallint,
        text
    )
to authenticated;

commit;
