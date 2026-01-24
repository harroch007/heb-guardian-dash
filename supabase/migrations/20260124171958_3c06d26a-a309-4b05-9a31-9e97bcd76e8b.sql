-- Step 1: Fix the upsert_app_usage function to populate child_id
CREATE OR REPLACE FUNCTION public.upsert_app_usage(
  p_app_name text, 
  p_device_id text, 
  p_package_name text, 
  p_usage_minutes integer, 
  p_usage_date date DEFAULT ((now() AT TIME ZONE 'Asia/Jerusalem'))::date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_child_id UUID;
BEGIN
  -- Find child_id from devices table
  SELECT child_id INTO v_child_id
  FROM public.devices
  WHERE device_id = p_device_id;

  -- Stamp first_seen_at once (first real device activity)
  UPDATE public.devices
  SET first_seen_at = COALESCE(first_seen_at, now())
  WHERE device_id = p_device_id;

  INSERT INTO public.app_usage (
    app_name, device_id, package_name, usage_minutes, 
    usage_date, child_id, updated_at
  )
  VALUES (
    p_app_name, p_device_id, p_package_name, p_usage_minutes, 
    p_usage_date, v_child_id, now()
  )
  ON CONFLICT (device_id, package_name, usage_date)
  DO UPDATE SET
    app_name = EXCLUDED.app_name,
    usage_minutes = EXCLUDED.usage_minutes,
    child_id = COALESCE(EXCLUDED.child_id, app_usage.child_id),
    updated_at = now();
END;
$function$;

-- Step 2: Fix existing records with NULL child_id
UPDATE app_usage au
SET child_id = d.child_id
FROM devices d
WHERE au.device_id = d.device_id
  AND au.child_id IS NULL
  AND d.child_id IS NOT NULL;