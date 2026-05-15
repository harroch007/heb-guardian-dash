
-- 1. State table for per-place inside/outside tracking
CREATE TABLE IF NOT EXISTS public.child_place_state (
  child_id uuid NOT NULL,
  place_id uuid NOT NULL,
  is_inside boolean NOT NULL,
  last_transition_at timestamptz NOT NULL DEFAULT now(),
  last_alert_at timestamptz,
  PRIMARY KEY (child_id, place_id)
);

ALTER TABLE public.child_place_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view their children place state"
  ON public.child_place_state FOR SELECT
  TO authenticated
  USING (is_family_parent(child_id));

CREATE POLICY "Admins can view all place state"
  ON public.child_place_state FOR SELECT
  TO authenticated
  USING (is_admin());

-- 2. Geofence evaluator (called from update_device_location)
CREATE OR REPLACE FUNCTION public.evaluate_geofences(
  p_child_id uuid,
  p_device_id text,
  p_lat double precision,
  p_lon double precision
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r_place RECORD;
  v_settings RECORD;
  v_address text;
  v_child_name text;
  v_distance double precision;
  v_inside boolean;
  v_prev_state RECORD;
  v_now timestamptz := now();
  v_local_now timestamptz := (now() AT TIME ZONE 'Asia/Jerusalem');
  v_local_dow int;
  v_local_time time;
  v_in_schedule boolean;
  v_is_first boolean;
  v_label text;
  v_msg text;
  v_should_alert boolean;
  v_alert_type text;
  v_cooldown_minutes int := 5;
BEGIN
  IF p_child_id IS NULL OR p_lat IS NULL OR p_lon IS NULL THEN
    RETURN;
  END IF;

  SELECT name INTO v_child_name FROM children WHERE id = p_child_id;
  SELECT address INTO v_address FROM devices WHERE device_id = p_device_id;

  SELECT * INTO v_settings
  FROM child_geofence_settings
  WHERE child_id = p_child_id
  LIMIT 1;

  -- ISO day mapping: Sunday=1..Saturday=7
  v_local_dow := ((EXTRACT(DOW FROM v_local_now)::int) + 1);
  IF v_local_dow > 7 THEN v_local_dow := v_local_dow - 7; END IF;
  v_local_time := v_local_now::time;

  FOR r_place IN
    SELECT * FROM child_places
    WHERE child_id = p_child_id AND is_active = true
  LOOP
    -- Haversine in meters
    v_distance := 6371000 * 2 * asin(
      sqrt(
        power(sin(radians(p_lat - r_place.latitude) / 2), 2) +
        cos(radians(r_place.latitude)) * cos(radians(p_lat)) *
        power(sin(radians(p_lon - r_place.longitude) / 2), 2)
      )
    );
    v_inside := v_distance <= r_place.radius_meters;

    -- Schedule gating
    v_in_schedule := true;
    IF r_place.schedule_mode = 'SCHEDULED'
       AND r_place.days_of_week IS NOT NULL
       AND r_place.start_time IS NOT NULL
       AND r_place.end_time IS NOT NULL THEN
      IF NOT (v_local_dow = ANY(r_place.days_of_week)) THEN
        v_in_schedule := false;
      ELSIF r_place.start_time <= r_place.end_time THEN
        v_in_schedule := v_local_time >= r_place.start_time AND v_local_time <= r_place.end_time;
      ELSE
        -- overnight window
        v_in_schedule := v_local_time >= r_place.start_time OR v_local_time <= r_place.end_time;
      END IF;
    END IF;

    -- Global per-type toggles
    IF r_place.place_type = 'HOME' AND v_settings.home_exit_alert_enabled IS NOT DISTINCT FROM false THEN
      v_in_schedule := false;
    ELSIF r_place.place_type = 'SCHOOL' AND v_settings.school_exit_alert_enabled IS NOT DISTINCT FROM false THEN
      v_in_schedule := false;
    END IF;

    SELECT * INTO v_prev_state
    FROM child_place_state
    WHERE child_id = p_child_id AND place_id = r_place.id;

    v_is_first := NOT FOUND;
    v_should_alert := false;
    v_alert_type := NULL;

    IF v_is_first THEN
      INSERT INTO child_place_state(child_id, place_id, is_inside, last_transition_at)
      VALUES (p_child_id, r_place.id, v_inside, v_now);

      -- Bootstrap: if child is currently OUTSIDE a place that alerts on exit, fire once
      IF NOT v_inside AND r_place.alert_on_exit AND v_in_schedule THEN
        v_should_alert := true;
        v_alert_type := 'exit';
      END IF;
    ELSE
      IF v_prev_state.is_inside <> v_inside THEN
        UPDATE child_place_state
        SET is_inside = v_inside, last_transition_at = v_now
        WHERE child_id = p_child_id AND place_id = r_place.id;

        -- Cooldown check
        IF v_prev_state.last_alert_at IS NULL
           OR v_now - v_prev_state.last_alert_at > make_interval(mins => v_cooldown_minutes) THEN
          IF NOT v_inside AND r_place.alert_on_exit AND v_in_schedule THEN
            v_should_alert := true;
            v_alert_type := 'exit';
          ELSIF v_inside AND r_place.alert_on_enter AND v_in_schedule THEN
            v_should_alert := true;
            v_alert_type := 'enter';
          END IF;
        END IF;
      END IF;
    END IF;

    IF v_should_alert THEN
      v_label := COALESCE(
        r_place.label,
        CASE r_place.place_type
          WHEN 'HOME' THEN 'בית'
          WHEN 'SCHOOL' THEN 'בית ספר'
          ELSE 'מקום'
        END
      );

      IF v_alert_type = 'exit' THEN
        v_msg := COALESCE(v_child_name, 'הילד/ה') || ' יצא/ה מאזור ' || v_label
                 || CASE WHEN v_address IS NOT NULL AND v_address <> '' THEN ' — מיקום נוכחי: ' || v_address ELSE '' END;
      ELSE
        v_msg := COALESCE(v_child_name, 'הילד/ה') || ' הגיע/ה לאזור ' || v_label;
      END IF;

      INSERT INTO alerts(
        child_id, device_id, category, alert_type,
        parent_message, content, source, platform,
        is_processed, should_alert, should_store, ai_status
      ) VALUES (
        p_child_id, p_device_id, 'geofence',
        CASE WHEN v_alert_type = 'exit' THEN 'warning' ELSE 'info' END,
        v_msg, v_msg, 'geofence', 'SYSTEM',
        true, true, true, 'skipped'
      );

      UPDATE child_place_state
      SET last_alert_at = v_now
      WHERE child_id = p_child_id AND place_id = r_place.id;
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  -- Never break location reporting because of geofence eval
  RAISE WARNING 'evaluate_geofences failed: %', SQLERRM;
END;
$$;

-- 3. Wire evaluate_geofences into update_device_location
CREATE OR REPLACE FUNCTION public.update_device_location(
  p_device_id text,
  p_lat double precision,
  p_lon double precision,
  p_address text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_child_id uuid;
BEGIN
  UPDATE devices
  SET
    latitude = p_lat,
    longitude = p_lon,
    address = COALESCE(p_address, address),
    last_seen = NOW()
  WHERE device_id = p_device_id;

  IF p_lat IS NOT NULL AND p_lon IS NOT NULL THEN
    SELECT child_id INTO v_child_id FROM devices WHERE device_id = p_device_id;
    IF v_child_id IS NOT NULL THEN
      PERFORM maybe_recalc_nearest_issur_window(v_child_id, p_lat, p_lon);
      PERFORM evaluate_geofences(v_child_id, p_device_id, p_lat, p_lon);
    END IF;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
