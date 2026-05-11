
CREATE OR REPLACE FUNCTION public.report_pending_app(
  p_device_id text,
  p_package_name text,
  p_app_name text DEFAULT NULL,
  p_was_blocked_attempt boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_jwt_role text;
  v_jwt_device_id text;
  v_child_id uuid;
  v_existed boolean := false;
  v_recent_alert boolean := false;
BEGIN
  -- Validate inputs
  IF p_device_id IS NULL OR length(trim(p_device_id)) = 0 THEN
    RAISE EXCEPTION 'p_device_id is required';
  END IF;
  IF p_package_name IS NULL OR length(trim(p_package_name)) = 0 THEN
    RAISE EXCEPTION 'p_package_name is required';
  END IF;

  -- 2-tier authorization gate (mirrors report_installed_apps)
  v_jwt_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  v_jwt_device_id := public.get_device_id_from_jwt();

  IF v_jwt_role = 'device' AND v_jwt_device_id = p_device_id THEN
    NULL; -- Tier 1: device JWT
  ELSE
    -- Tier 2: Legacy fallback — device must exist and be paired
    IF NOT EXISTS (
      SELECT 1 FROM public.devices
      WHERE device_id = p_device_id AND child_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED';
    END IF;
  END IF;

  -- Resolve child_id server-side
  SELECT child_id INTO v_child_id
  FROM public.devices
  WHERE device_id = p_device_id;

  IF v_child_id IS NULL THEN
    RAISE EXCEPTION 'Device not linked to a child';
  END IF;

  -- Check if app already exists in installed_apps (drives push dedup)
  SELECT EXISTS (
    SELECT 1 FROM public.installed_apps
    WHERE child_id = v_child_id AND package_name = p_package_name
  ) INTO v_existed;

  -- Upsert into installed_apps. Preserves existing app_name when payload is NULL.
  INSERT INTO public.installed_apps (child_id, package_name, app_name, is_system, last_seen_at)
  VALUES (v_child_id, p_package_name, p_app_name, false, now())
  ON CONFLICT (child_id, package_name)
  DO UPDATE SET
    app_name     = COALESCE(EXCLUDED.app_name, public.installed_apps.app_name),
    last_seen_at = now();

  -- Optional: log a blocked attempt
  IF p_was_blocked_attempt THEN
    INSERT INTO public.blocked_app_attempts (device_id, child_id, package_name, app_name)
    VALUES (p_device_id, v_child_id, p_package_name, p_app_name);
  END IF;

  -- Push dedup: only fire app_alerts on first sighting OR if no alert in last 24h
  SELECT EXISTS (
    SELECT 1 FROM public.app_alerts
    WHERE child_id = v_child_id
      AND package_name = p_package_name
      AND created_at > now() - interval '24 hours'
  ) INTO v_recent_alert;

  IF NOT v_recent_alert THEN
    PERFORM public.create_app_alert(p_device_id, p_package_name, p_app_name);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'child_id', v_child_id,
    'is_new', NOT v_existed,
    'pending', NOT EXISTS (
      SELECT 1 FROM public.app_policies
      WHERE child_id = v_child_id AND package_name = p_package_name
    ),
    'push_sent', NOT v_recent_alert
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.report_pending_app(text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_pending_app(text, text, text, boolean) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
