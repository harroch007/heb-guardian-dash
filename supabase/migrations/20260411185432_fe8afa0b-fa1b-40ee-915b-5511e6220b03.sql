
-- Step 1: Create the unified authorization helper
CREATE OR REPLACE FUNCTION public.authorize_device_call(p_device_id text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_jwt_device_id text;
  v_child_id uuid;
BEGIN
  -- Tier 1: JWT-based authentication (device role)
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL AND v_caller_uid != '00000000-0000-0000-0000-000000000000'::uuid THEN
    v_jwt_device_id := coalesce(
      current_setting('request.jwt.claims', true)::json->>'device_id',
      ''
    );
    -- If caller has a device JWT, verify device_id matches
    IF v_jwt_device_id != '' THEN
      IF v_jwt_device_id != p_device_id THEN
        RAISE EXCEPTION 'DEVICE_ID_MISMATCH';
      END IF;
    END IF;
    -- Authenticated caller (device JWT or parent) — resolve child_id
    SELECT child_id INTO v_child_id FROM devices WHERE device_id = p_device_id;
    IF v_child_id IS NOT NULL THEN
      RETURN v_child_id;
    END IF;
  END IF;

  -- Tier 2: Legacy fallback — anon caller with device_id
  IF p_device_id IS NOT NULL THEN
    SELECT child_id INTO v_child_id
    FROM devices
    WHERE device_id = p_device_id AND child_id IS NOT NULL;
    IF v_child_id IS NOT NULL THEN
      RETURN v_child_id;
    END IF;
  END IF;

  RAISE EXCEPTION 'UNAUTHORIZED: device not paired or invalid credentials';
END;
$$;

-- Grant execute to both roles
GRANT EXECUTE ON FUNCTION public.authorize_device_call(text) TO anon;
GRANT EXECUTE ON FUNCTION public.authorize_device_call(text) TO authenticated;

-- Step 2: Drop both overloads of complete_chore
DROP FUNCTION IF EXISTS public.complete_chore(uuid);
DROP FUNCTION IF EXISTS public.complete_chore(uuid, text);

-- Step 3: Create unified complete_chore with device auth support
CREATE OR REPLACE FUNCTION public.complete_chore(
  p_chore_id uuid,
  p_photo_base64 text DEFAULT NULL,
  p_device_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chore RECORD;
  v_caller_uid uuid;
  v_authorized boolean := false;
  v_device_child_id uuid;
BEGIN
  -- Load the chore
  SELECT * INTO v_chore FROM chores WHERE id = p_chore_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CHORE_NOT_FOUND');
  END IF;

  -- Authorization: check JWT first
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL AND v_caller_uid != '00000000-0000-0000-0000-000000000000'::uuid THEN
    -- Authenticated user (parent calling approve/reject, or device with JWT)
    v_authorized := true;
  END IF;

  -- If not authorized via JWT, try device legacy fallback
  IF NOT v_authorized AND p_device_id IS NOT NULL THEN
    v_device_child_id := public.authorize_device_call(p_device_id);
    -- Verify the chore belongs to this device's child
    IF v_device_child_id = v_chore.child_id THEN
      v_authorized := true;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'CHILD_MISMATCH');
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  -- Business logic
  IF v_chore.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'current_status', v_chore.status);
  END IF;

  UPDATE chores
  SET status = 'completed_by_child',
      completed_at = now(),
      proof_photo_base64 = COALESCE(p_photo_base64, proof_photo_base64)
  WHERE id = p_chore_id;

  RETURN jsonb_build_object('success', true, 'chore_id', p_chore_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_chore(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.complete_chore(uuid, text, text) TO authenticated;

-- Step 4: Replace request_extra_time with device auth support
DROP FUNCTION IF EXISTS public.request_extra_time(uuid, text);

CREATE OR REPLACE FUNCTION public.request_extra_time(
  p_child_id uuid,
  p_reason text,
  p_device_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
  v_request_id uuid;
  v_caller_uid uuid;
  v_authorized boolean := false;
  v_device_child_id uuid;
BEGIN
  -- Authorization: check JWT first
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL AND v_caller_uid != '00000000-0000-0000-0000-000000000000'::uuid THEN
    v_authorized := true;
  END IF;

  -- If not authorized via JWT, try device legacy fallback
  IF NOT v_authorized AND p_device_id IS NOT NULL THEN
    v_device_child_id := public.authorize_device_call(p_device_id);
    IF v_device_child_id = p_child_id THEN
      v_authorized := true;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'CHILD_MISMATCH');
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  -- Find parent
  SELECT parent_id INTO v_parent_id FROM children WHERE id = p_child_id;
  IF v_parent_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'CHILD_NOT_FOUND');
  END IF;

  -- Check for existing pending request (prevent spam)
  IF EXISTS (
    SELECT 1 FROM time_extension_requests
    WHERE child_id = p_child_id AND status = 'pending'
      AND created_at > now() - interval '10 minutes'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'REQUEST_ALREADY_PENDING');
  END IF;

  INSERT INTO time_extension_requests (child_id, parent_id, reason)
  VALUES (p_child_id, v_parent_id, p_reason)
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_extra_time(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.request_extra_time(uuid, text, text) TO authenticated;
