begin;

-- Preserve the active snapshot contract and repair only the missing-settings
-- fallback. Continuous location is mandatory for every protected child.
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
        coalesce(settings_row.location_tracking_enabled, true),
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

-- CREATE OR REPLACE retains the owner; keep the device service-only boundary
-- explicit so a future grant cannot broaden this RPC accidentally.
revoke all on function public.v2_parental_settings_snapshot_service(uuid)
from public, anon, authenticated;
grant execute on function public.v2_parental_settings_snapshot_service(uuid)
to service_role;

comment on function public.v2_parental_settings_snapshot_service(uuid) is
    'Returns the device settings snapshot with mandatory continuous location enabled, including when a settings row has not been created yet.';

commit;
