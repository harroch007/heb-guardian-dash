CREATE OR REPLACE FUNCTION public.update_device_status(p_device_id text, p_battery integer DEFAULT NULL::integer, p_lat double precision DEFAULT NULL::double precision, p_lon double precision DEFAULT NULL::double precision, p_device_model text DEFAULT NULL::text, p_device_manufacturer text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_jwt_role text;
  v_jwt_device_id text;
  v_child_id UUID;
  v_now_israel TIMESTAMP;
  v_today DATE;
  v_current_time TIME;
  v_dow INT;
  v_block_reason TEXT := NULL;
  v_is_blocked BOOLEAN := FALSE;
  v_effective_limit INT := NULL;
  v_used_minutes INT := 0;
  v_base_limit INT;
  v_bonus_minutes INT;
  v_parent_id UUID;
  v_schedule RECORD;
  v_now_epoch BIGINT;
BEGIN
  v_jwt_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  v_jwt_device_id := public.get_device_id_from_jwt();

  IF v_jwt_role = 'device' AND v_jwt_device_id = p_device_id THEN
    NULL;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.devices
      WHERE device_id = p_device_id AND child_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED';
    END IF;
  END IF;

  UPDATE public.devices
  SET
    first_seen_at       = COALESCE(first_seen_at, now()),
    last_seen           = now(),
    battery_level       = COALESCE(p_battery, battery_level),
    latitude            = COALESCE(p_lat, latitude),
    longitude           = COALESCE(p_lon, longitude),
    device_model        = COALESCE(p_device_model, devices.device_model),
    device_manufacturer = COALESCE(p_device_manufacturer, devices.device_manufacturer)
  WHERE device_id = p_device_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEVICE_NOT_FOUND_OR_NOT_PAIRED';
  END IF;

  SELECT child_id INTO v_child_id FROM devices WHERE device_id = p_device_id;

  IF v_child_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_blocked_now', false,
      'block_reason', null,
      'effective_limit_minutes', null,
      'used_minutes_today', 0
    );
  END IF;

  v_now_israel := now() AT TIME ZONE 'Asia/Jerusalem';
  v_today := v_now_israel::date;
  v_current_time := v_now_israel::time;
  v_dow := EXTRACT(ISODOW FROM v_now_israel)::int;
  v_now_epoch := (EXTRACT(EPOCH FROM now()) * 1000)::bigint;

  IF EXISTS (
    SELECT 1 FROM issur_melacha_windows
    WHERE child_id = v_child_id
      AND is_active = true
      AND v_now_epoch >= start_epoch_ms
      AND v_now_epoch <= end_epoch_ms
  ) THEN
    v_is_blocked := true;
    v_block_reason := 'SHABBAT';
  END IF;

  IF NOT v_is_blocked THEN
    FOR v_schedule IN
      SELECT schedule_type, start_time, end_time, days_of_week, mode,
             manual_start_time, manual_end_time
      FROM schedule_windows
      WHERE child_id = v_child_id AND is_active = true
      ORDER BY
        CASE schedule_type
          WHEN 'shabbat' THEN 1
          WHEN 'bedtime' THEN 2
          WHEN 'school'  THEN 3
          ELSE 4
        END
    LOOP
      DECLARE
        v_start TIME := CASE WHEN v_schedule.mode = 'manual' AND v_schedule.manual_start_time IS NOT NULL
                              THEN v_schedule.manual_start_time
                              ELSE v_schedule.start_time END;
        v_end TIME   := CASE WHEN v_schedule.mode = 'manual' AND v_schedule.manual_end_time IS NOT NULL
                              THEN v_schedule.manual_end_time
                              ELSE v_schedule.end_time END;
        v_in_window BOOLEAN := false;
      BEGIN
        IF v_schedule.days_of_week IS NOT NULL AND array_length(v_schedule.days_of_week, 1) > 0 THEN
          IF NOT (v_dow = ANY(v_schedule.days_of_week)) THEN
            CONTINUE;
          END IF;
        END IF;

        IF v_start IS NOT NULL AND v_end IS NOT NULL THEN
          IF v_start > v_end THEN
            v_in_window := (v_current_time >= v_start OR v_current_time <= v_end);
          ELSE
            v_in_window := (v_current_time >= v_start AND v_current_time <= v_end);
          END IF;

          IF v_in_window THEN
            v_is_blocked := true;
            v_block_reason := UPPER(v_schedule.schedule_type);
            EXIT;
          END IF;
        END IF;
      END;
    END LOOP;
  END IF;

  SELECT parent_id INTO v_parent_id FROM children WHERE id = v_child_id;

  SELECT s.daily_screen_time_limit_minutes INTO v_base_limit
  FROM settings s WHERE s.device_id = p_device_id LIMIT 1;

  IF v_base_limit IS NULL THEN
    SELECT s.daily_screen_time_limit_minutes INTO v_base_limit
    FROM settings s WHERE s.child_id = v_child_id AND s.device_id IS NULL LIMIT 1;
  END IF;

  IF v_base_limit IS NULL AND v_parent_id IS NOT NULL THEN
    SELECT s.daily_screen_time_limit_minutes INTO v_base_limit
    FROM settings s WHERE s.parent_id = v_parent_id AND s.child_id IS NULL AND s.device_id IS NULL LIMIT 1;
  END IF;

  SELECT COALESCE(SUM(usage_minutes), 0) INTO v_used_minutes
  FROM app_usage
  WHERE child_id = v_child_id AND usage_date = v_today;

  IF v_base_limit IS NOT NULL THEN
    SELECT COALESCE(SUM(bonus_minutes), 0) INTO v_bonus_minutes
    FROM bonus_time_grants
    WHERE child_id = v_child_id AND grant_date = v_today;

    v_effective_limit := v_base_limit + COALESCE(v_bonus_minutes, 0);

    IF NOT v_is_blocked AND v_used_minutes >= v_effective_limit THEN
      v_is_blocked := true;
      v_block_reason := 'DAILY_LIMIT_REACHED';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_blocked_now', v_is_blocked,
    'block_reason', v_block_reason,
    'effective_limit_minutes', v_effective_limit,
    'used_minutes_today', v_used_minutes
  );
END;
$function$;