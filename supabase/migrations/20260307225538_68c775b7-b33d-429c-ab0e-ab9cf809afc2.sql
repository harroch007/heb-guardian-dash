
-- Gap 1: RPC for parent access to device heartbeat data
CREATE OR REPLACE FUNCTION public.get_child_device_health(p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_device_id text;
  v_result jsonb;
BEGIN
  -- Verify caller owns the child
  IF NOT EXISTS (
    SELECT 1 FROM children WHERE id = p_child_id AND parent_id = auth.uid()
  ) THEN
    RETURN NULL;
  END IF;

  -- Get most recently active device for this child
  SELECT device_id INTO v_device_id
  FROM devices
  WHERE child_id = p_child_id
  ORDER BY last_seen DESC NULLS LAST
  LIMIT 1;

  IF v_device_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get latest heartbeat for that device
  SELECT jsonb_build_object(
    'permissions', h.permissions,
    'device', h.device,
    'reported_at', h.reported_at,
    'device_id', h.device_id
  ) INTO v_result
  FROM device_heartbeats_raw h
  WHERE h.device_id = v_device_id
  ORDER BY h.reported_at DESC
  LIMIT 1;

  RETURN v_result;
END;
$$;
