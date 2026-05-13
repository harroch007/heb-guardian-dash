
-- Lost Mode: device_lock_state table
CREATE TABLE IF NOT EXISTS public.device_lock_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL UNIQUE,
  is_locked boolean NOT NULL DEFAULT false,
  contact_name text,
  contact_phone text,
  message text,
  locked_at timestamptz,
  locked_by uuid,
  unlocked_at timestamptz,
  unlocked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.device_lock_state ENABLE ROW LEVEL SECURITY;

-- Parents (family) can view their children's lock state
CREATE POLICY "Parents can view their children lock state"
ON public.device_lock_state
FOR SELECT
TO authenticated
USING (public.is_family_parent(child_id));

-- Parents can insert lock state for their children
CREATE POLICY "Parents can insert lock state for their children"
ON public.device_lock_state
FOR INSERT
TO authenticated
WITH CHECK (public.is_family_parent(child_id));

-- Parents can update their children's lock state
CREATE POLICY "Parents can update their children lock state"
ON public.device_lock_state
FOR UPDATE
TO authenticated
USING (public.is_family_parent(child_id))
WITH CHECK (public.is_family_parent(child_id));

-- Admins can view all lock states
CREATE POLICY "Admins can view all lock states"
ON public.device_lock_state
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Devices (anon, paired) can read their own child's lock state so the Android overlay service knows when to engage
CREATE POLICY "Devices can read their own lock state"
ON public.device_lock_state
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.devices d
    WHERE d.child_id = device_lock_state.child_id
      AND public.is_paired_device(d.device_id)
  )
);

-- updated_at trigger
CREATE TRIGGER set_device_lock_state_updated_at
BEFORE UPDATE ON public.device_lock_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RPC: lock_child_device — sets lock state + enqueues command to all child devices
-- ============================================================
CREATE OR REPLACE FUNCTION public.lock_child_device(
  p_child_id uuid,
  p_contact_name text,
  p_contact_phone text,
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_devices_count int := 0;
  v_dev record;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_family_parent(p_child_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_contact_phone IS NULL OR length(trim(p_contact_phone)) = 0 THEN
    RAISE EXCEPTION 'contact_phone is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.device_lock_state (
    child_id, is_locked, contact_name, contact_phone, message, locked_at, locked_by, unlocked_at, unlocked_by
  )
  VALUES (
    p_child_id, true, p_contact_name, p_contact_phone, p_message, now(), v_caller, NULL, NULL
  )
  ON CONFLICT (child_id) DO UPDATE
    SET is_locked = true,
        contact_name = EXCLUDED.contact_name,
        contact_phone = EXCLUDED.contact_phone,
        message = EXCLUDED.message,
        locked_at = now(),
        locked_by = v_caller,
        unlocked_at = NULL,
        unlocked_by = NULL,
        updated_at = now();

  -- Enqueue LOCK_DEVICE command to every device of the child
  FOR v_dev IN SELECT device_id FROM public.devices WHERE child_id = p_child_id LOOP
    INSERT INTO public.device_commands (device_id, command_type, status)
    VALUES (v_dev.device_id, 'LOCK_DEVICE', 'PENDING');
    v_devices_count := v_devices_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'devices_notified', v_devices_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.lock_child_device(uuid, text, text, text) TO authenticated;

-- ============================================================
-- RPC: unlock_child_device
-- ============================================================
CREATE OR REPLACE FUNCTION public.unlock_child_device(p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_devices_count int := 0;
  v_dev record;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_family_parent(p_child_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.device_lock_state
     SET is_locked = false,
         unlocked_at = now(),
         unlocked_by = v_caller,
         updated_at = now()
   WHERE child_id = p_child_id;

  FOR v_dev IN SELECT device_id FROM public.devices WHERE child_id = p_child_id LOOP
    INSERT INTO public.device_commands (device_id, command_type, status)
    VALUES (v_dev.device_id, 'UNLOCK_DEVICE', 'PENDING');
    v_devices_count := v_devices_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'devices_notified', v_devices_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_child_device(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
