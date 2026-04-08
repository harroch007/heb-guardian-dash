
-- Add previous_child_id to track which child a device was linked to before disconnect
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS previous_child_id uuid;

-- Drop existing function (returns void, we need jsonb)
DROP FUNCTION IF EXISTS public.disconnect_device(text);

-- Recreate with jsonb return + previous_child_id preservation
CREATE OR REPLACE FUNCTION public.disconnect_device(p_device_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_child_id uuid;
  v_parent_id uuid;
BEGIN
  SELECT child_id INTO v_child_id
  FROM public.devices
  WHERE device_id = p_device_id;

  IF v_child_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'DEVICE_NOT_FOUND_OR_NOT_LINKED');
  END IF;

  SELECT parent_id INTO v_parent_id
  FROM public.children
  WHERE id = v_child_id;

  IF v_parent_id IS NULL OR v_parent_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  UPDATE public.devices
  SET previous_child_id = child_id,
      child_id = NULL
  WHERE device_id = p_device_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.disconnect_device(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.disconnect_device(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.disconnect_device(text) TO authenticated;

-- Lookup function for disconnected devices
CREATE OR REPLACE FUNCTION public.get_disconnected_devices(p_child_id uuid)
RETURNS TABLE(device_id text, device_model text, device_manufacturer text, last_seen timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_parent_id uuid;
BEGIN
  SELECT parent_id INTO v_parent_id
  FROM public.children
  WHERE id = p_child_id;

  IF v_parent_id IS NULL OR v_parent_id != auth.uid() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT d.device_id, d.device_model, d.device_manufacturer, d.last_seen
  FROM public.devices d
  WHERE d.child_id IS NULL
    AND d.previous_child_id = p_child_id
  ORDER BY d.last_seen DESC NULLS LAST
  LIMIT 5;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_disconnected_devices(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_disconnected_devices(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_disconnected_devices(uuid) TO authenticated;
