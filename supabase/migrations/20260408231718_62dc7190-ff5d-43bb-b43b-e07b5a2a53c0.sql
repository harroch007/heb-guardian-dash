
CREATE OR REPLACE FUNCTION public.reconnect_device(p_child_id uuid, p_device_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_parent_id uuid;
  v_current_child_id uuid;
  v_device_model text;
BEGIN
  -- Owner-only: verify caller owns this child
  SELECT parent_id INTO v_parent_id
  FROM public.children
  WHERE id = p_child_id;

  IF v_parent_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'CHILD_NOT_FOUND');
  END IF;

  IF v_parent_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  -- Verify device exists and is currently unlinked
  SELECT child_id, device_model INTO v_current_child_id, v_device_model
  FROM public.devices
  WHERE device_id = p_device_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'DEVICE_NOT_FOUND');
  END IF;

  IF v_current_child_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'DEVICE_ALREADY_LINKED');
  END IF;

  -- Re-link the device to the child
  UPDATE public.devices
  SET child_id = p_child_id,
      last_seen = now()
  WHERE device_id = p_device_id
    AND child_id IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'device_id', p_device_id,
    'device_model', v_device_model
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconnect_device(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconnect_device(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reconnect_device(uuid, text) TO authenticated;
