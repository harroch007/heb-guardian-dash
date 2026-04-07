
-- RPC: disconnect_device (owner-only)
-- Sets devices.child_id = NULL only if the caller owns the child linked to that device.
CREATE OR REPLACE FUNCTION public.disconnect_device(p_device_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_child_id uuid;
BEGIN
  -- Resolve the child that owns this device
  SELECT child_id INTO v_child_id
  FROM devices
  WHERE device_id = p_device_id;

  IF v_child_id IS NULL THEN
    RAISE EXCEPTION 'Device not found or already disconnected';
  END IF;

  -- Owner-only check: child.parent_id must equal the caller
  IF NOT EXISTS (
    SELECT 1 FROM children
    WHERE id = v_child_id AND parent_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Permission denied: only the owner can disconnect a device';
  END IF;

  -- Perform the disconnect
  UPDATE devices
  SET child_id = NULL
  WHERE device_id = p_device_id;
END;
$$;
