
-- Add device model info columns
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS device_model TEXT;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS device_manufacturer TEXT;

-- Update update_device_status to accept optional model info
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
AS $function$
BEGIN
  UPDATE public.devices
  SET
    first_seen_at  = COALESCE(first_seen_at, now()),
    last_seen      = now(),
    battery_level  = p_battery,
    latitude       = p_lat,
    longitude      = p_lon,
    device_model   = COALESCE(p_device_model, device_model),
    device_manufacturer = COALESCE(p_device_manufacturer, device_manufacturer)
  WHERE device_id = p_device_id;

  IF NOT FOUND THEN
    INSERT INTO public.devices(
      device_id, first_seen_at, last_seen,
      battery_level, latitude, longitude,
      device_model, device_manufacturer,
      created_at
    )
    VALUES (
      p_device_id, now(), now(),
      p_battery, p_lat, p_lon,
      p_device_model, p_device_manufacturer,
      now()
    );
  END IF;
END;
$function$;
