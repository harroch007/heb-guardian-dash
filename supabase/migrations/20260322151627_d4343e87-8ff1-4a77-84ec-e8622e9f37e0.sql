
CREATE OR REPLACE FUNCTION public.update_device_location(
  p_device_id text,
  p_lat double precision,
  p_lon double precision,
  p_address text DEFAULT NULL::text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
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

  -- Recalculate nearest issur window if child moved significantly
  IF p_lat IS NOT NULL AND p_lon IS NOT NULL THEN
    SELECT child_id INTO v_child_id FROM devices WHERE device_id = p_device_id;
    IF v_child_id IS NOT NULL THEN
      PERFORM maybe_recalc_nearest_issur_window(v_child_id, p_lat, p_lon);
    END IF;
  END IF;
END;
$$;
