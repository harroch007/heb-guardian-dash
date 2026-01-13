DROP FUNCTION IF EXISTS public.upsert_app_usage(text, text, text, integer);

CREATE OR REPLACE FUNCTION public.upsert_app_usage(
  p_app_name text,
  p_device_id text,
  p_package_name text,
  p_usage_minutes integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Stamp first_seen_at once (first real device activity)
  UPDATE public.devices
  SET first_seen_at = COALESCE(first_seen_at, now())
  WHERE device_id = p_device_id;

  INSERT INTO public.app_usage (app_name, device_id, package_name, usage_minutes, usage_date)
  VALUES (p_app_name, p_device_id, p_package_name, p_usage_minutes, CURRENT_DATE)
  ON CONFLICT (device_id, package_name, usage_date)
  DO UPDATE SET
    usage_minutes = EXCLUDED.usage_minutes,
    updated_at = now();
END;
$$;