-- Phase 4E: Harden report_installed_apps — device-only fail-closed

CREATE OR REPLACE FUNCTION public.report_installed_apps(p_device_id text, p_apps jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_jwt_role text;
  v_jwt_device_id text;
  v_child_id uuid;
  v_app jsonb;
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

  -- Resolve child_id server-side from verified device identity
  SELECT child_id INTO v_child_id
  FROM public.devices
  WHERE device_id = v_jwt_device_id;

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

-- Lock down EXECUTE grants
REVOKE EXECUTE ON FUNCTION public.report_installed_apps(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_installed_apps(text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_installed_apps(text, jsonb) TO authenticated;