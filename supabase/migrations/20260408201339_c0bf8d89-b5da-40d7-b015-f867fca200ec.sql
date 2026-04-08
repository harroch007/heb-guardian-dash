-- Phase 4D: Harden report_device_heartbeat — device-only fail-closed

CREATE OR REPLACE FUNCTION public.report_device_heartbeat(
  p_child_id uuid,
  p_device jsonb,
  p_device_id text,
  p_permissions jsonb,
  p_timestamp timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_jwt_role text;
    v_jwt_device_id text;
    v_resolved_child_id uuid;
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

    -- Resolve child_id from devices table (do NOT trust p_child_id)
    SELECT child_id INTO v_resolved_child_id
    FROM public.devices
    WHERE device_id = v_jwt_device_id;

    -- Insert heartbeat with server-resolved child_id
    INSERT INTO public.device_heartbeats_raw (child_id, device_id, device, permissions, reported_at)
    VALUES (v_resolved_child_id, v_jwt_device_id, p_device, p_permissions, coalesce(p_timestamp, now()));
END;
$$;

-- Lock down EXECUTE grants
REVOKE EXECUTE ON FUNCTION public.report_device_heartbeat(uuid, jsonb, text, jsonb, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_device_heartbeat(uuid, jsonb, text, jsonb, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_device_heartbeat(uuid, jsonb, text, jsonb, timestamptz) TO authenticated;