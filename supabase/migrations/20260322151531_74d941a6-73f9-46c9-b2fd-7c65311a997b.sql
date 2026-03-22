
-- ═══════════════════════════════════════════════════════
-- Haversine distance in km between two lat/lon points
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) RETURNS double precision
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  R constant double precision := 6371.0;
  dlat double precision;
  dlon double precision;
  a double precision;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)^2;
  RETURN R * 2 * asin(sqrt(a));
END;
$$;

-- ═══════════════════════════════════════════════════════
-- NOAA sunset calculator — returns sunset as timestamptz
-- for a given lat/lon and date
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.calc_sunset_utc(
  p_lat double precision, p_lon double precision, p_date date
) RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  yr int; mo int; dy int;
  A int; B int; JD double precision; T double precision;
  L0 double precision; M double precision; Mrad double precision;
  e double precision; C double precision; sunLon double precision;
  omega double precision; lambda double precision; lambdaRad double precision;
  obliq0 double precision; obliqCorr double precision; obliqRad double precision;
  sinDec double precision; decl double precision;
  y double precision; L0rad double precision; EqTime double precision;
  latRad double precision; cosHA double precision; HA double precision;
  sunsetMin double precision;
  sunsetH int; sunsetM int; sunsetS int;
BEGIN
  yr := extract(year from p_date)::int;
  mo := extract(month from p_date)::int;
  dy := extract(day from p_date)::int;

  IF mo <= 2 THEN yr := yr - 1; mo := mo + 12; END IF;

  A := yr / 100;
  B := 2 - A + A / 4;
  JD := floor(365.25 * (yr + 4716)) + floor(30.6001 * (mo + 1)) + dy + B - 1524.5;
  T := (JD - 2451545.0) / 36525.0;

  L0 := (280.46646 + T * (36000.76983 + 0.0003032 * T));
  L0 := L0 - floor(L0 / 360.0) * 360.0;
  M := 357.52911 + T * (35999.05029 - 0.0001537 * T);
  Mrad := radians(M);
  e := 0.016708634 - T * (0.000042037 + 0.0000001267 * T);

  C := (1.914602 - T * (0.004817 + 0.000014 * T)) * sin(Mrad)
     + (0.019993 - 0.000101 * T) * sin(2 * Mrad)
     + 0.000289 * sin(3 * Mrad);
  sunLon := L0 + C;

  omega := 125.04 - 1934.136 * T;
  lambda := sunLon - 0.00569 - 0.00478 * sin(radians(omega));
  lambdaRad := radians(lambda);

  obliq0 := 23.0 + (26.0 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60.0) / 60.0;
  obliqCorr := obliq0 + 0.00256 * cos(radians(omega));
  obliqRad := radians(obliqCorr);

  sinDec := sin(obliqRad) * sin(lambdaRad);
  decl := asin(sinDec);

  y := tan(obliqRad / 2) ^ 2;
  L0rad := radians(L0);
  EqTime := 4.0 * degrees(
    y * sin(2 * L0rad)
    - 2 * e * sin(Mrad)
    + 4 * e * y * sin(Mrad) * cos(2 * L0rad)
    - 0.5 * y * y * sin(4 * L0rad)
    - 1.25 * e * e * sin(2 * Mrad)
  );

  latRad := radians(p_lat);
  cosHA := (cos(radians(90.833)) / (cos(latRad) * cos(decl))) - tan(latRad) * tan(decl);

  IF cosHA > 1 OR cosHA < -1 THEN
    RETURN (p_date::timestamp + interval '16 hours') AT TIME ZONE 'UTC';
  END IF;

  HA := degrees(acos(cosHA));
  sunsetMin := 720.0 - 4.0 * (p_lon - HA) - EqTime;

  sunsetH := floor(sunsetMin / 60)::int;
  sunsetM := floor(sunsetMin - sunsetH * 60)::int;
  sunsetS := round((sunsetMin - sunsetH * 60 - sunsetM) * 60)::int;

  RETURN (p_date::timestamp + make_interval(hours => sunsetH, mins => sunsetM, secs => sunsetS)) AT TIME ZONE 'UTC';
END;
$$;

-- ═══════════════════════════════════════════════════════
-- Maybe recalculate the nearest issur_melacha window
-- Called on every location update; no-ops if conditions not met
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.maybe_recalc_nearest_issur_window(
  p_child_id uuid,
  p_new_lat double precision,
  p_new_lon double precision
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_window RECORD;
  v_dist_km double precision;
  v_now_ms bigint;
  v_hours_until double precision;
  v_candle_offset_ms bigint := -18 * 60 * 1000;
  v_havdalah_offset_ms bigint := 32 * 60 * 1000;
  v_event_date date;
  v_erev_date date;
  v_erev_sunset timestamptz;
  v_day_sunset timestamptz;
  v_new_start_ms bigint;
  v_new_end_ms bigint;
BEGIN
  v_now_ms := (extract(epoch from now()) * 1000)::bigint;

  -- Find nearest future active window
  SELECT * INTO v_window
  FROM issur_melacha_windows
  WHERE child_id = p_child_id
    AND is_active = true
    AND start_epoch_ms > v_now_ms
  ORDER BY start_epoch_ms ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Check: within 12 hours?
  v_hours_until := (v_window.start_epoch_ms - v_now_ms) / 3600000.0;
  IF v_hours_until > 12.0 THEN
    RETURN;
  END IF;

  -- Check: distance > 25 km?
  v_dist_km := haversine_km(v_window.latitude, v_window.longitude, p_new_lat, p_new_lon);
  IF v_dist_km <= 25.0 THEN
    RETURN;
  END IF;

  -- Recalculate sunset times for this window
  -- valid_for_date is the erev date (Friday for Shabbat, erev chag for yom tov)
  v_erev_date := v_window.valid_for_date::date;
  v_event_date := v_erev_date + 1;

  v_erev_sunset := calc_sunset_utc(p_new_lat, p_new_lon, v_erev_date);
  v_day_sunset := calc_sunset_utc(p_new_lat, p_new_lon, v_event_date);

  v_new_start_ms := (extract(epoch from v_erev_sunset) * 1000)::bigint + v_candle_offset_ms;
  v_new_end_ms := (extract(epoch from v_day_sunset) * 1000)::bigint + v_havdalah_offset_ms;

  RAISE LOG '[issur-recalc] child=% event=% dist=%.1f km old_loc=(%.4f,%.4f) new_loc=(%.4f,%.4f) old_start=% old_end=% new_start=% new_end=%',
    p_child_id, v_window.event_key, v_dist_km,
    v_window.latitude, v_window.longitude, p_new_lat, p_new_lon,
    to_timestamp(v_window.start_epoch_ms / 1000.0) AT TIME ZONE 'Asia/Jerusalem',
    to_timestamp(v_window.end_epoch_ms / 1000.0) AT TIME ZONE 'Asia/Jerusalem',
    to_timestamp(v_new_start_ms / 1000.0) AT TIME ZONE 'Asia/Jerusalem',
    to_timestamp(v_new_end_ms / 1000.0) AT TIME ZONE 'Asia/Jerusalem';

  UPDATE issur_melacha_windows
  SET start_epoch_ms = v_new_start_ms,
      end_epoch_ms = v_new_end_ms,
      latitude = p_new_lat,
      longitude = p_new_lon,
      computed_at = now()::text
  WHERE id = v_window.id;
END;
$$;
