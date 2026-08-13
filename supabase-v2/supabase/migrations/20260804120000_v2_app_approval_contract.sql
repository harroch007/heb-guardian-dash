begin;

-- Installed-app provenance is intentionally coarse. The raw installer package
-- remains optional, while the normalized source is safe for policy decisions.
create type public.v2_app_install_source as enum (
    'store',
    'sideload',
    'unknown'
);

alter table public.v2_parental_installed_apps
    add column is_launchable boolean not null default false,
    add column install_source public.v2_app_install_source
        not null default 'unknown'::public.v2_app_install_source,
    add column installer_package_name text;

alter table public.v2_parental_installed_apps
    add constraint v2_parental_installed_apps_installer_package
    check (
        installer_package_name is null
        or (
            char_length(installer_package_name) between 3 and 255
            and installer_package_name ~ '^[A-Za-z0-9_.]+$'
        )
    );

alter table public.v2_parental_settings
    add column app_approval_baseline_completed boolean
        not null default false;

alter table public.v2_protected_devices
    add column app_approval_baseline_completed boolean
        not null default false;

comment on column public.v2_parental_installed_apps.is_launchable is
    'True only when Android reports a launchable application surface.';
comment on column public.v2_parental_installed_apps.install_source is
    'Normalized installation source: store, sideload, or unknown.';
comment on column public.v2_parental_installed_apps.installer_package_name is
    'Optional Android installer package; never used alone as an approval decision.';
comment on column public.v2_parental_settings.app_approval_baseline_completed is
    'Aggregate marker that at least one device baseline completed; device snapshots use the per-device marker.';
comment on column public.v2_protected_devices.app_approval_baseline_completed is
    'Per-installation one-time marker. Replacement devices establish their own initial app baseline.';

-- Legacy rows have no trustworthy launchability metadata and keep the new
-- default false until an updated child client reports them. They are still
-- policy-backfilled below so rollout cannot mass-block an existing app, but
-- helper/plugin packages do not leak into the guardian UI meanwhile.

-- Preserve every explicit guardian decision, especially blocked policies.
-- Existing non-system inventory is approved only when no policy exists.
insert into public.v2_parental_app_policies (
    child_id,
    package_name,
    app_name,
    policy_status,
    daily_limit_minutes,
    always_allowed,
    updated_by
)
select distinct on (device.child_id, installed.package_name)
    device.child_id,
    installed.package_name,
    installed.app_name,
    'approved',
    null::smallint,
    false,
    null::uuid
  from public.v2_parental_installed_apps installed
  join public.v2_protected_devices device
    on device.id = installed.device_id
 where not installed.is_system
   and installed.is_installed
 order by
    device.child_id,
    installed.package_name,
    installed.is_installed desc,
    installed.last_seen_at desc,
    installed.device_id
on conflict (child_id, package_name) do nothing;

update public.v2_protected_devices device
   set app_approval_baseline_completed = true
 where exists (
        select 1
          from public.v2_parental_installed_apps installed
         where installed.device_id = device.id
           and installed.is_installed
    );

-- Only a currently installed inventory row proves a successful legacy app
-- snapshot. A device-state row alone is insufficient: the legacy Android
-- collector could still persist device state after package enumeration failed
-- and returned an empty array. Treating that as a baseline would make every
-- launchable app pending at once.
insert into public.v2_parental_settings (
    child_id,
    revision,
    app_approval_baseline_completed,
    updated_by
)
select distinct
    device.child_id,
    1,
    true,
    null::uuid
  from public.v2_protected_devices device
 where device.app_approval_baseline_completed
on conflict (child_id) do nothing;

-- The baseline flag and the policies are part of the settings snapshot. Bump
-- the revision exactly once for every existing child whose baseline changes.
update public.v2_parental_settings settings
   set app_approval_baseline_completed = true,
       revision = settings.revision + 1,
       updated_by = null
 where not settings.app_approval_baseline_completed
   and exists (
        select 1
          from public.v2_protected_devices device
         where device.child_id = settings.child_id
           and device.app_approval_baseline_completed
   );

-- Evidence may belong to a retired device, but any resulting shared settings
-- revision must be queued to every device that is active or degraded.
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
    jsonb_build_object('settings_revision', settings.revision),
    'pending',
    left(
        'settings:app-approval-backfill-20260804:' || device.id::text,
        240
    ),
    now(),
    now() + interval '5 minutes',
    null::uuid
  from public.v2_protected_devices device
  join public.v2_parental_settings settings
    on settings.child_id = device.child_id
 where device.status in ('active', 'degraded')
   and settings.app_approval_baseline_completed
   and exists (
        select 1
          from public.v2_protected_devices evidence_device
         where evidence_device.child_id = device.child_id
           and evidence_device.app_approval_baseline_completed
   )
on conflict (device_id, idempotency_key) do nothing;

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
    null::uuid,
    'service',
    'v2.parental.app_approval_baseline.backfill',
    'child',
    settings.child_id,
    'success',
    jsonb_build_object(
        'settings_revision', settings.revision,
        'approved_policy_count', (
            select count(*)
              from public.v2_parental_app_policies policy
             where policy.child_id = settings.child_id
               and policy.policy_status = 'approved'
        )
    )
  from public.v2_parental_settings settings
 where settings.app_approval_baseline_completed
   and exists (
        select 1
          from public.v2_protected_devices device
         where device.child_id = settings.child_id
           and device.app_approval_baseline_completed
   );

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
    device_baseline_completed boolean;
    settings_row public.v2_parental_settings%rowtype;
    bonus_total integer;
    policies jsonb;
    schedules jsonb;
    geofences jsonb;
    request_updates jsonb;
begin
    select
        device.child_id,
        device.app_approval_baseline_completed
      into target_child_id, device_baseline_completed
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
        'app_approval_baseline_completed',
        coalesce(device_baseline_completed, false),
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
    target_child_id uuid;
    existing_event uuid;
    app_item jsonb;
    usage_item jsonb;
    attempt_item jsonb;
    current_state_changed boolean := false;
    inventory_metadata_complete boolean := false;
    baseline_completed boolean := false;
    baseline_policy_count integer := 0;
    baseline_revision bigint;
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

    -- Serialize per-device baseline completion and the shared child policy
    -- revision. The event idempotency check runs after these locks.
    select
        device.child_id,
        device.app_approval_baseline_completed
      into target_child_id, baseline_completed
      from public.v2_protected_devices device
      join public.v2_children child on child.id = device.child_id
     where device.id = target_device_id
       and device.status in ('active', 'degraded')
     for update of child, device;
    if target_child_id is null then
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
           settings_revision_applied = excluded.settings_revision_applied,
           usage_date = excluded.usage_date,
           total_screen_minutes = excluded.total_screen_minutes,
           latitude = excluded.latitude,
           longitude = excluded.longitude,
           location_accuracy_meters = excluded.location_accuracy_meters,
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

    -- A non-empty installed_apps array is a full snapshot. Empty is retained
    -- as "inventory unavailable" for compatibility with an older Android
    -- collector that returned [] after PackageManager failures; it must never
    -- erase the last known inventory.
    if jsonb_array_length(target_installed_apps) > 0 then
        update public.v2_parental_installed_apps installed
           set is_installed = false
         where installed.device_id = target_device_id;

        for app_item in
            select value from jsonb_array_elements(target_installed_apps)
        loop
        if jsonb_typeof(app_item) <> 'object'
           or app_item->>'package_name' is null
           or char_length(app_item->>'package_name') not between 3 and 255
           or (app_item->>'package_name') !~ '^[A-Za-z0-9_.]+$'
           or (
                app_item ? 'is_system'
                and jsonb_typeof(app_item->'is_system') <> 'boolean'
           )
           or (
                app_item ? 'is_launchable'
                and jsonb_typeof(app_item->'is_launchable') <> 'boolean'
           )
           or (
                app_item ? 'install_source'
                and (
                    jsonb_typeof(app_item->'install_source') <> 'string'
                    or app_item->>'install_source' not in (
                        'store',
                        'sideload',
                        'unknown'
                    )
                )
            )
           or (
                app_item ? 'baseline_eligible'
                and jsonb_typeof(app_item->'baseline_eligible') <>
                    'boolean'
            )
           or (
                app_item ? 'installer_package_name'
                and jsonb_typeof(app_item->'installer_package_name')
                    not in ('string', 'null')
           )
           or (
                nullif(app_item->>'installer_package_name', '') is not null
                and (
                    char_length(app_item->>'installer_package_name')
                        not between 3 and 255
                    or (app_item->>'installer_package_name')
                        !~ '^[A-Za-z0-9_.]+$'
                )
           ) then
            raise exception 'invalid_installed_app'
                using errcode = '22023';
        end if;

            insert into public.v2_parental_installed_apps (
            device_id,
            package_name,
            app_name,
            is_system,
            is_launchable,
            install_source,
            installer_package_name,
            is_installed,
            last_seen_at
        )
            values (
            target_device_id,
            app_item->>'package_name',
            nullif(left(app_item->>'app_name', 160), ''),
            coalesce((app_item->>'is_system')::boolean, false),
            coalesce((app_item->>'is_launchable')::boolean, false),
            coalesce(
                (app_item->>'install_source')::public.v2_app_install_source,
                'unknown'::public.v2_app_install_source
            ),
            nullif(left(app_item->>'installer_package_name', 255), ''),
            true,
            target_observed_at
        )
            on conflict (device_id, package_name) do update
           set app_name = coalesce(
                   excluded.app_name,
                   public.v2_parental_installed_apps.app_name
               ),
               is_system = excluded.is_system,
               is_launchable = case
                   when app_item ? 'is_launchable'
                       then excluded.is_launchable
                   else public.v2_parental_installed_apps.is_launchable
               end,
               install_source = case
                   when app_item ? 'install_source'
                       then excluded.install_source
                   else public.v2_parental_installed_apps.install_source
               end,
               installer_package_name = case
                   when app_item ? 'installer_package_name'
                       then excluded.installer_package_name
                   else public.v2_parental_installed_apps.installer_package_name
               end,
               is_installed = true,
                   last_seen_at = excluded.last_seen_at;
        end loop;
    end if;

    inventory_metadata_complete :=
        -- A real Android package inventory is non-empty. Requiring at least
        -- one item keeps an empty legacy/error payload from sealing baseline.
        jsonb_array_length(target_installed_apps) > 0
        and not exists (
            select 1
              from jsonb_array_elements(target_installed_apps) item
             where jsonb_typeof(item) <> 'object'
                or not item ? 'is_launchable'
                or not item ? 'install_source'
                or not item ? 'baseline_eligible'
        );

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

    if inventory_metadata_complete then
        insert into public.v2_parental_settings (
            child_id,
            revision,
            app_approval_baseline_completed,
            updated_by
        )
        values (
            target_child_id,
            1,
            false,
            null::uuid
        )
        on conflict (child_id) do nothing;

        -- The immutable device snapshot may contain a pre-feature app that a
        -- stale legacy inventory missed during migration backfill. Reconcile
        -- eligible policies on every complete report, without ever replacing
        -- an explicit approved or blocked guardian decision.
        insert into public.v2_parental_app_policies (
            child_id,
            package_name,
            app_name,
            policy_status,
            daily_limit_minutes,
            always_allowed,
            updated_by
        )
        select distinct on (baseline_item->>'package_name')
            target_child_id,
            baseline_item->>'package_name',
            nullif(left(baseline_item->>'app_name', 160), ''),
            'approved',
            null::smallint,
            false,
            null::uuid
          from jsonb_array_elements(target_installed_apps) baseline_item
         where (baseline_item->>'baseline_eligible')::boolean
           and (baseline_item->>'is_launchable')::boolean
           and not coalesce(
                (baseline_item->>'is_system')::boolean,
                false
           )
         order by
            baseline_item->>'package_name'
        on conflict (child_id, package_name) do nothing;
        get diagnostics baseline_policy_count = row_count;

        if not baseline_completed then
            update public.v2_protected_devices device
               set app_approval_baseline_completed = true,
                   updated_at = now()
             where device.id = target_device_id
               and not device.app_approval_baseline_completed;
        end if;

        if not baseline_completed or baseline_policy_count > 0 then
            update public.v2_parental_settings settings
               set app_approval_baseline_completed = true,
                   revision = settings.revision + 1,
                   updated_by = null
             where settings.child_id = target_child_id
            returning settings.revision into baseline_revision;

            if baseline_revision is not null then
                perform public.v2_enqueue_refresh_for_child_service(
                    target_child_id,
                    null::uuid,
                    'app-approval-baseline:' || target_event_key::text,
                    baseline_revision
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
                    null::uuid,
                    'device',
                    case
                        when not baseline_completed then
                            'v2.parental.app_approval_baseline.complete'
                        else
                            'v2.parental.app_approval_baseline.reconcile'
                    end,
                    'child',
                    target_child_id,
                    'success',
                    jsonb_build_object(
                        'device_id', target_device_id,
                        'settings_revision', baseline_revision,
                        'approved_policy_count', baseline_policy_count
                    )
                );
            end if;
        end if;
    end if;

    return query select true, current_state_changed;
end;
$$;

-- CREATE OR REPLACE retains the existing owner and ACL, and these explicit
-- statements keep the service-only execution boundary reviewable in this file.
revoke all on function public.v2_parental_settings_snapshot_service(uuid)
from public, anon, authenticated;
grant execute on function public.v2_parental_settings_snapshot_service(uuid)
to service_role;

revoke all on function public.v2_report_parental_state_service(
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
grant execute on function public.v2_report_parental_state_service(
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

comment on function public.v2_parental_settings_snapshot_service(uuid) is
    'Returns the device settings snapshot, including that installation''s per-device app approval baseline state.';
comment on function public.v2_report_parental_state_service(
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
) is
    'Atomically stores full parental state and installed-app metadata; each installation closes its own baseline on its first complete report, while later complete reports reconcile missing eligible policies without overriding existing decisions.';

commit;
