
-- Phase 4B: Harden update_device_status — device-only fail-closed + safe overload consolidation

-- Step 1: Replace the 6-param overload with fail-closed device-only version (no insert fallback)
CREATE OR REPLACE FUNCTION public.update_device_status(
  p_device_id text,
  p_battery integer,
  p_lat double precision,
  p_lon double precision,
  p_device_model text DEFAULT NULL,
  p_device_manufacturer text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_jwt_role text;
  v_jwt_device_id text;
BEGIN
  -- Fail-closed authorization gate: device-only
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  v_jwt_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  IF v_jwt_role IS DISTINCT FROM 'device' THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  v_jwt_device_id := public.get_device_id_from_jwt();
  IF v_jwt_device_id IS NULL OR v_jwt_device_id != p_device_id THEN
    RAISE EXCEPTION 'DEVICE_ID_MISMATCH';
  END IF;

  UPDATE public.devices
  SET
    first_seen_at       = COALESCE(first_seen_at, now()),
    last_seen           = now(),
    battery_level       = p_battery,
    latitude            = p_lat,
    longitude           = p_lon,
    device_model        = COALESCE(p_device_model, device_model),
    device_manufacturer = COALESCE(p_device_manufacturer, device_manufacturer)
  WHERE device_id = p_device_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEVICE_NOT_FOUND_OR_NOT_PAIRED';
  END IF;
END;
$$;

-- Step 2: Replace the 4-param overload with a compatibility shim delegating to the authoritative 6-param
CREATE OR REPLACE FUNCTION public.update_device_status(
  p_device_id text,
  p_battery integer,
  p_lat double precision,
  p_lon double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.update_device_status(
    p_device_id,
    p_battery,
    p_lat,
    p_lon,
    NULL,
    NULL
  );
END;
$$;

-- Step 3: Lock down EXECUTE grants on both overloads
REVOKE EXECUTE ON FUNCTION public.update_device_status(text, integer, double precision, double precision) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_device_status(text, integer, double precision, double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_device_status(text, integer, double precision, double precision) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_device_status(text, integer, double precision, double precision, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_device_status(text, integer, double precision, double precision, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_device_status(text, integer, double precision, double precision, text, text) TO authenticated;
