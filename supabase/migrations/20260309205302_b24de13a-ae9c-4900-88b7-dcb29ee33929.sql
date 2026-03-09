-- 1. Delete stale installed_apps rows for the tested child
DELETE FROM installed_apps
WHERE child_id = '6233e88a-0212-4682-a350-442681e95a5f'
  AND last_seen_at < '2026-03-09T20:42:59+00'::timestamptz;

-- 2. Replace report_installed_apps with full-snapshot semantics
CREATE OR REPLACE FUNCTION public.report_installed_apps(
  p_device_id text,
  p_apps jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
  v_app jsonb;
BEGIN
  -- Resolve child_id from device
  SELECT child_id INTO v_child_id
  FROM devices
  WHERE device_id = p_device_id;

  IF v_child_id IS NULL THEN
    RAISE EXCEPTION 'Device not linked to a child';
  END IF;

  -- Upsert each reported app
  FOR v_app IN SELECT * FROM jsonb_array_elements(p_apps)
  LOOP
    INSERT INTO installed_apps (child_id, package_name, app_name, is_system, last_seen_at)
    VALUES (
      v_child_id,
      v_app->>'package_name',
      v_app->>'app_name',
      COALESCE((v_app->>'is_system')::boolean, false),
      now()
    )
    ON CONFLICT (child_id, package_name)
    DO UPDATE SET
      app_name    = COALESCE(EXCLUDED.app_name, installed_apps.app_name),
      is_system   = EXCLUDED.is_system,
      last_seen_at = now();
  END LOOP;

  -- Full-snapshot: delete packages NOT in the current payload
  DELETE FROM installed_apps
  WHERE child_id = v_child_id
    AND package_name NOT IN (
      SELECT p->>'package_name'
      FROM jsonb_array_elements(p_apps) AS p
    );
END;
$$;