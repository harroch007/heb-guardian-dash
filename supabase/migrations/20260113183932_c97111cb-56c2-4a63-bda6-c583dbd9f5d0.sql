DROP FUNCTION IF EXISTS public.update_device_status(text, integer, double precision, double precision);

CREATE OR REPLACE FUNCTION public.update_device_status(
  p_device_id text,
  p_battery integer DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lon double precision DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Stamp first_seen_at once (first real device activity)
  UPDATE public.devices
  SET first_seen_at = COALESCE(first_seen_at, now())
  WHERE device_id = p_device_id;

  UPDATE public.devices
  SET
    battery_level = COALESCE(p_battery, battery_level),
    latitude = COALESCE(p_lat, latitude),
    longitude = COALESCE(p_lon, longitude),
    last_seen = now()
  WHERE device_id = p_device_id;
END;
$$;