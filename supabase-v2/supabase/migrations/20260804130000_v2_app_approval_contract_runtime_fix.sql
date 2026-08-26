begin;

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

