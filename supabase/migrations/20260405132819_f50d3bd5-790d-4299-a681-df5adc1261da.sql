
CREATE OR REPLACE FUNCTION public.get_device_settings(p_device_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_settings JSONB;
    v_child_id UUID;
    v_parent_id UUID;
    v_blocked_apps JSONB;
    v_app_policies JSONB;
    v_schedules JSONB;
    v_shabbat_row RECORD;
    v_computed_shabbat RECORD;
    v_start_epoch bigint;
    v_end_epoch bigint;
    v_base_limit INT;
    v_bonus_minutes INT;
    v_reward RECORD;
    v_issur_windows JSONB;
    v_geofence_places JSONB;
    v_manual_geofence_places JSONB;
    v_geofence_settings RECORD;
    v_time_request_updates JSONB;
BEGIN
    SELECT child_id INTO v_child_id FROM devices WHERE device_id = p_device_id;
    IF v_child_id IS NOT NULL THEN
        SELECT parent_id INTO v_parent_id FROM children WHERE id = v_child_id;
    END IF;
    
    SELECT row_to_json(s.*)::jsonb INTO v_settings
    FROM settings s
    WHERE s.device_id = p_device_id
    LIMIT 1;
    
    IF v_settings IS NULL AND v_child_id IS NOT NULL THEN
        SELECT row_to_json(s.*)::jsonb INTO v_settings
        FROM settings s
        WHERE s.child_id = v_child_id AND s.device_id IS NULL
        LIMIT 1;
    END IF;
    
    IF v_settings IS NULL AND v_parent_id IS NOT NULL THEN
        SELECT row_to_json(s.*)::jsonb INTO v_settings
        FROM settings s
        WHERE s.parent_id = v_parent_id AND s.child_id IS NULL AND s.device_id IS NULL
        LIMIT 1;
    END IF;
    
    IF v_settings IS NULL THEN
        v_settings := jsonb_build_object(
            'monitoring_enabled', true,
            'notification_listener_enabled', true,
            'accessibility_service_enabled', true,
            'redaction_mode', 'STRICT',
            'local_llm_enabled', false,
            'remote_llm_enabled', true,
            'alert_on_trigger_words', true,
            'alert_on_unknown_contacts', true,
            'alert_threshold', 70,
            'screen_time_tracking_enabled', true,
            'daily_screen_time_limit_minutes', null,
            'location_tracking_enabled', true,
            'location_update_interval_minutes', 15,
            'blocked_apps', '[]'::jsonb,
            'custom_trigger_words', '[]'::jsonb,
            'version', 0
        );
    END IF;
    
    IF v_child_id IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(ap.package_name), '[]'::jsonb)
        INTO v_blocked_apps
        FROM app_policies ap
        WHERE ap.child_id = v_child_id AND ap.is_blocked = true;

        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'package_name', ap.package_name,
            'policy_status', CASE WHEN ap.is_blocked THEN 'blocked' ELSE 'approved' END,
            'daily_limit_minutes', null,
            'always_allowed', ap.always_allowed
          )
        ), '[]'::jsonb)
        INTO v_app_policies
        FROM app_policies ap
        WHERE ap.child_id = v_child_id;
        
        v_settings := v_settings || jsonb_build_object(
          'blocked_apps', v_blocked_apps,
          'app_policies', v_app_policies
        );
    END IF;

    IF v_child_id IS NOT NULL THEN
        v_base_limit := (v_settings->>'daily_screen_time_limit_minutes')::int;
        
        IF v_base_limit IS NOT NULL THEN
            SELECT COALESCE(SUM(bonus_minutes), 0) INTO v_bonus_minutes
            FROM bonus_time_grants
            WHERE child_id = v_child_id
              AND grant_date = (now() AT TIME ZONE 'Asia/Jerusalem')::date;
            
            v_settings := v_settings || jsonb_build_object(
                'effective_screen_time_limit_minutes', v_base_limit + v_bonus_minutes,
                'bonus_minutes_today', v_bonus_minutes
            );
        END IF;
    END IF;

    IF v_child_id IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', sw.id,
            'name', sw.name,
            'schedule_type', sw.schedule_type,
            'days_of_week', sw.days_of_week,
            'start_time', sw.start_time,
            'end_time', sw.end_time
          )
        ), '[]'::jsonb)
        INTO v_schedules
        FROM schedule_windows sw
        WHERE sw.child_id = v_child_id AND sw.is_active = true;

        -- Get static shabbat zmanim (Jerusalem fallback)
        SELECT sz.* INTO v_shabbat_row
        FROM shabbat_zmanim sz
        WHERE sz.friday_date >= CURRENT_DATE
        ORDER BY sz.friday_date
        LIMIT 1;

        -- Try computed (location-based) shabbat times first
        SELECT * INTO v_computed_shabbat
        FROM shabbat_times_computed stc
        WHERE stc.child_id = v_child_id
          AND stc.friday_date >= CURRENT_DATE
        ORDER BY stc.friday_date
        LIMIT 1;

        IF v_computed_shabbat IS NOT NULL THEN
          v_start_epoch := v_computed_shabbat.start_epoch_ms;
          v_end_epoch := v_computed_shabbat.end_epoch_ms;

          v_settings := v_settings || jsonb_build_object(
            'next_shabbat', jsonb_build_object(
              'friday_date', v_computed_shabbat.friday_date,
              'candle_lighting', COALESCE(v_shabbat_row.candle_lighting, '00:00:00'::time),
              'havdalah', COALESCE(v_shabbat_row.havdalah, '00:00:00'::time),
              'shabbat_start_epoch_ms', v_start_epoch,
              'shabbat_end_epoch_ms', v_end_epoch
            )
          );
        ELSIF v_shabbat_row IS NOT NULL THEN
          v_start_epoch := (EXTRACT(EPOCH FROM (
            (v_shabbat_row.friday_date + v_shabbat_row.candle_lighting) AT TIME ZONE 'Asia/Jerusalem'
          )) * 1000)::bigint;
          v_end_epoch := (EXTRACT(EPOCH FROM (
            ((v_shabbat_row.friday_date + 1) + v_shabbat_row.havdalah) AT TIME ZONE 'Asia/Jerusalem'
          )) * 1000)::bigint;

          v_settings := v_settings || jsonb_build_object(
            'next_shabbat', jsonb_build_object(
              'friday_date', v_shabbat_row.friday_date,
              'candle_lighting', v_shabbat_row.candle_lighting,
              'havdalah', v_shabbat_row.havdalah,
              'shabbat_start_epoch_ms', v_start_epoch,
              'shabbat_end_epoch_ms', v_end_epoch
            )
          );
        END IF;

        -- Issur Melacha Windows (shabbat + yom tov)
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'lock_type', imw.lock_type,
            'event_name', imw.event_name,
            'event_key', imw.event_key,
            'start_epoch_ms', imw.start_epoch_ms,
            'end_epoch_ms', imw.end_epoch_ms
          ) ORDER BY imw.start_epoch_ms
        ), '[]'::jsonb)
        INTO v_issur_windows
        FROM (
          SELECT * FROM issur_melacha_windows
          WHERE child_id = v_child_id
            AND is_active = true
            AND end_epoch_ms > (EXTRACT(EPOCH FROM now()) * 1000)::bigint
          ORDER BY start_epoch_ms
          LIMIT 10
        ) imw;

        v_settings := v_settings || jsonb_build_object('issur_melacha_windows', v_issur_windows);

        v_settings := v_settings || jsonb_build_object('schedule_windows', v_schedules);

        -- Reward bank + streak
        SELECT balance_minutes, current_streak
        INTO v_reward
        FROM reward_bank
        WHERE child_id = v_child_id;

        IF v_reward IS NOT NULL THEN
          v_settings := v_settings || jsonb_build_object(
            'reward_balance_minutes', v_reward.balance_minutes,
            'current_streak', v_reward.current_streak
          );
        ELSE
          v_settings := v_settings || jsonb_build_object(
            'reward_balance_minutes', 0,
            'current_streak', 0
          );
        END IF;

        -- Geofence places: HOME/SCHOOL only (Android-safe)
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'place_type', cp.place_type,
            'label', cp.label,
            'latitude', cp.latitude,
            'longitude', cp.longitude,
            'radius_meters', cp.radius_meters
          )
        ), '[]'::jsonb)
        INTO v_geofence_places
        FROM child_places cp
        WHERE cp.child_id = v_child_id 
          AND cp.is_active = true
          AND cp.place_type IN ('HOME', 'SCHOOL');

        v_settings := v_settings || jsonb_build_object('geofence_places', v_geofence_places);

        -- Manual geofence places (new, for future Android consumption)
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', cp.id,
            'label', cp.label,
            'latitude', cp.latitude,
            'longitude', cp.longitude,
            'radius_meters', cp.radius_meters,
            'is_active', cp.is_active,
            'alert_on_enter', cp.alert_on_enter,
            'alert_on_exit', cp.alert_on_exit,
            'schedule_mode', cp.schedule_mode,
            'days_of_week', cp.days_of_week,
            'start_time', cp.start_time,
            'end_time', cp.end_time
          )
        ), '[]'::jsonb)
        INTO v_manual_geofence_places
        FROM child_places cp
        WHERE cp.child_id = v_child_id
          AND cp.is_active = true
          AND cp.place_type = 'MANUAL';

        v_settings := v_settings || jsonb_build_object('manual_geofence_places', v_manual_geofence_places);

        -- Geofence settings (with safe defaults)
        SELECT * INTO v_geofence_settings
        FROM child_geofence_settings
        WHERE child_id = v_child_id;

        IF v_geofence_settings IS NOT NULL THEN
          v_settings := v_settings || jsonb_build_object(
            'geofence_settings', jsonb_build_object(
              'home_exit_alert_enabled', v_geofence_settings.home_exit_alert_enabled,
              'school_exit_alert_enabled', v_geofence_settings.school_exit_alert_enabled,
              'exit_debounce_seconds', v_geofence_settings.exit_debounce_seconds
            )
          );
        ELSE
          v_settings := v_settings || jsonb_build_object(
            'geofence_settings', jsonb_build_object(
              'home_exit_alert_enabled', true,
              'school_exit_alert_enabled', true,
              'exit_debounce_seconds', 120
            )
          );
        END IF;

        -- Time request updates (child-facing response payload)
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'request_id', tr.id,
            'status', tr.status,
            'approved_minutes', CASE WHEN tr.status = 'approved' THEN tr.requested_minutes ELSE null END,
            'responded_at', tr.responded_at
          ) ORDER BY tr.responded_at DESC
        ), '[]'::jsonb)
        INTO v_time_request_updates
        FROM (
          SELECT id, status, requested_minutes, responded_at
          FROM time_extension_requests
          WHERE child_id = v_child_id
            AND status IN ('approved', 'rejected')
            AND responded_at IS NOT NULL
          ORDER BY responded_at DESC
          LIMIT 20
        ) tr;

        v_settings := v_settings || jsonb_build_object('time_request_updates', v_time_request_updates);
    END IF;
    
    RETURN v_settings;
END;
$$;
