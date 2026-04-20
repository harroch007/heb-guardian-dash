
-- =============================================================
-- 1. Update get_device_settings RPC: fix daily_limit_minutes + add pending apps
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_device_settings(p_device_id text)
RETURNS jsonb
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
    v_jwt_device_id text;
    v_jwt_role text;
BEGIN
    -- 2-tier authorization gate
    v_jwt_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
    v_jwt_device_id := public.get_device_id_from_jwt();

    IF v_jwt_role = 'device' AND v_jwt_device_id = p_device_id THEN
        NULL; -- Tier 1: JWT-authenticated device
    ELSE
        -- Tier 2: Legacy fallback
        IF NOT EXISTS (
            SELECT 1 FROM public.devices
            WHERE device_id = p_device_id AND child_id IS NOT NULL
        ) THEN
            RETURN jsonb_build_object('error', 'UNAUTHORIZED', 'success', false);
        END IF;
    END IF;

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
    
    -- ============ APP POLICIES (fixed: daily_limit_minutes + pending apps) ============
    IF v_child_id IS NOT NULL THEN
        -- blocked_apps: includes explicitly blocked + pending (no policy) non-system apps
        SELECT COALESCE(jsonb_agg(pkg), '[]'::jsonb)
        INTO v_blocked_apps
        FROM (
            SELECT ap.package_name AS pkg
            FROM app_policies ap
            WHERE ap.child_id = v_child_id AND ap.is_blocked = true
            UNION
            SELECT ia.package_name AS pkg
            FROM installed_apps ia
            WHERE ia.child_id = v_child_id
              AND ia.is_system = false
              AND NOT EXISTS (
                  SELECT 1 FROM app_policies ap2
                  WHERE ap2.child_id = v_child_id
                    AND ap2.package_name = ia.package_name
              )
        ) all_blocked;

        -- app_policies: explicit policies + pending apps as pending_block
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'package_name', combined.package_name,
            'policy_status', combined.policy_status,
            'daily_limit_minutes', combined.daily_limit_minutes,
            'always_allowed', combined.always_allowed
          )
        ), '[]'::jsonb)
        INTO v_app_policies
        FROM (
            -- Apps with explicit policy
            SELECT ap.package_name,
                   CASE WHEN ap.is_blocked THEN 'blocked' ELSE 'approved' END AS policy_status,
                   CASE WHEN ap.is_blocked THEN -1 ELSE null::int END AS daily_limit_minutes,
                   ap.always_allowed
            FROM app_policies ap
            WHERE ap.child_id = v_child_id
            
            UNION ALL
            
            -- Installed apps without policy = pending_block
            SELECT ia.package_name,
                   'pending_block' AS policy_status,
                   -1 AS daily_limit_minutes,
                   false AS always_allowed
            FROM installed_apps ia
            WHERE ia.child_id = v_child_id
              AND ia.is_system = false
              AND NOT EXISTS (
                  SELECT 1 FROM app_policies ap2
                  WHERE ap2.child_id = v_child_id
                    AND ap2.package_name = ia.package_name
              )
        ) combined;
        
        v_settings := v_settings || jsonb_build_object(
          'blocked_apps', v_blocked_apps,
          'app_policies', v_app_policies
        );
    END IF;

    -- ============ SCREEN TIME (bonus + reward bank) ============
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

    -- ============ REWARD BANK ============
    IF v_child_id IS NOT NULL THEN
        SELECT balance_minutes, last_updated INTO v_reward
        FROM reward_bank
        WHERE child_id = v_child_id;
        
        IF FOUND THEN
            v_settings := v_settings || jsonb_build_object(
                'reward_bank_minutes', v_reward.balance_minutes
            );
        END IF;
    END IF;

    -- ============ SCHEDULES ============
    IF v_child_id IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', sw.id,
            'name', sw.name,
            'schedule_type', sw.schedule_type,
            'days_of_week', sw.days_of_week,
            'start_time', sw.start_time,
            'end_time', sw.end_time,
            'is_active', sw.is_active,
            'mode', COALESCE(sw.mode, 'default'),
            'manual_start_time', sw.manual_start_time,
            'manual_end_time', sw.manual_end_time
          )
        ), '[]'::jsonb)
        INTO v_schedules
        FROM schedule_windows sw
        WHERE sw.child_id = v_child_id;
        
        v_settings := v_settings || jsonb_build_object('schedules', v_schedules);
    END IF;

    -- ============ SHABBAT TIMES ============
    IF v_child_id IS NOT NULL THEN
        SELECT * INTO v_shabbat_row
        FROM shabbat_zmanim
        WHERE friday_date >= CURRENT_DATE
        ORDER BY friday_date
        LIMIT 1;

        IF v_shabbat_row IS NOT NULL THEN
            v_start_epoch := EXTRACT(EPOCH FROM v_shabbat_row.candle_lighting)::bigint;
            v_end_epoch   := EXTRACT(EPOCH FROM v_shabbat_row.havdalah)::bigint;
            
            v_settings := v_settings || jsonb_build_object(
                'next_shabbat', jsonb_build_object(
                    'friday_date', v_shabbat_row.friday_date,
                    'candle_lighting', v_shabbat_row.candle_lighting,
                    'havdalah', v_shabbat_row.havdalah,
                    'start_epoch', v_start_epoch,
                    'end_epoch', v_end_epoch
                )
            );
        END IF;
    END IF;

    -- ============ COMPUTED SHABBAT (holiday-aware) ============
    IF v_child_id IS NOT NULL THEN
        SELECT * INTO v_computed_shabbat
        FROM computed_shabbat_times
        WHERE start_time >= now()
        ORDER BY start_time
        LIMIT 1;

        IF v_computed_shabbat IS NOT NULL THEN
            v_settings := v_settings || jsonb_build_object(
                'next_issur', jsonb_build_object(
                    'label', v_computed_shabbat.label,
                    'start_time', v_computed_shabbat.start_time,
                    'end_time', v_computed_shabbat.end_time,
                    'start_epoch', EXTRACT(EPOCH FROM v_computed_shabbat.start_time)::bigint,
                    'end_epoch', EXTRACT(EPOCH FROM v_computed_shabbat.end_time)::bigint
                )
            );
        END IF;

        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'label', cst.label,
                'start_time', cst.start_time,
                'end_time', cst.end_time,
                'start_epoch', EXTRACT(EPOCH FROM cst.start_time)::bigint,
                'end_epoch', EXTRACT(EPOCH FROM cst.end_time)::bigint
            )
        ), '[]'::jsonb)
        INTO v_issur_windows
        FROM computed_shabbat_times cst
        WHERE cst.start_time >= now()
        ORDER BY cst.start_time
        LIMIT 10;

        v_settings := v_settings || jsonb_build_object('issur_windows', v_issur_windows);
    END IF;

    -- ============ GEOFENCE: home + school ============
    IF v_child_id IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'place_type', cp.place_type,
                'latitude', cp.latitude,
                'longitude', cp.longitude,
                'radius_meters', cp.radius_meters,
                'label', cp.label
            )
        ), '[]'::jsonb)
        INTO v_geofence_places
        FROM child_places cp
        WHERE cp.child_id = v_child_id
          AND cp.is_active = true
          AND cp.place_type IN ('home', 'school');

        v_settings := v_settings || jsonb_build_object('geofence_places', v_geofence_places);

        SELECT * INTO v_geofence_settings
        FROM child_geofence_settings
        WHERE child_id = v_child_id;

        IF FOUND THEN
            v_settings := v_settings || jsonb_build_object(
                'geofence_settings', jsonb_build_object(
                    'home_exit_alert_enabled', v_geofence_settings.home_exit_alert_enabled,
                    'school_exit_alert_enabled', v_geofence_settings.school_exit_alert_enabled,
                    'exit_debounce_seconds', v_geofence_settings.exit_debounce_seconds
                )
            );
        END IF;
    END IF;

    -- ============ GEOFENCE: manual places ============
    IF v_child_id IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', cp.id,
                'label', cp.label,
                'latitude', cp.latitude,
                'longitude', cp.longitude,
                'radius_meters', cp.radius_meters,
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
          AND cp.place_type = 'manual';

        v_settings := v_settings || jsonb_build_object('manual_geofence_places', v_manual_geofence_places);
    END IF;

    -- ============ PENDING TIME REQUEST UPDATES ============
    IF v_child_id IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', tr.id,
                'status', tr.status,
                'granted_minutes', tr.granted_minutes
            )
        ), '[]'::jsonb)
        INTO v_time_request_updates
        FROM time_requests tr
        WHERE tr.child_id = v_child_id
          AND tr.status IN ('approved', 'denied')
          AND tr.device_synced = false;

        v_settings := v_settings || jsonb_build_object('time_request_updates', v_time_request_updates);
    END IF;

    RETURN v_settings;
END;
$$;

-- =============================================================
-- 2. Trigger: auto-create REFRESH_SETTINGS on app_policies change
-- =============================================================
CREATE OR REPLACE FUNCTION public.notify_device_on_policy_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO device_commands (device_id, command_type, status)
  SELECT d.device_id, 'REFRESH_SETTINGS', 'PENDING'
  FROM devices d
  WHERE d.child_id = COALESCE(NEW.child_id, OLD.child_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_device_on_policy_change ON app_policies;
CREATE TRIGGER trg_notify_device_on_policy_change
  AFTER INSERT OR UPDATE OR DELETE ON app_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_device_on_policy_change();

-- =============================================================
-- 3. Align permissions
-- =============================================================
GRANT EXECUTE ON FUNCTION public.get_device_settings(text) TO anon, authenticated;
