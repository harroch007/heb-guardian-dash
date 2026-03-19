
-- =============================================
-- MISSION 1: time_extension_requests table + RPCs
-- =============================================

-- Table
CREATE TABLE public.time_extension_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  reason text,
  requested_minutes int NOT NULL DEFAULT 15,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

-- Validation trigger for status values
CREATE OR REPLACE FUNCTION public.validate_time_request_status()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_time_request_status
  BEFORE INSERT OR UPDATE ON public.time_extension_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_time_request_status();

-- RLS
ALTER TABLE public.time_extension_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents read own children requests"
  ON public.time_extension_requests
  FOR SELECT TO authenticated
  USING (parent_id = auth.uid());

CREATE POLICY "Parents update own children requests"
  ON public.time_extension_requests
  FOR UPDATE TO authenticated
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

-- RPC: request_extra_time (called by Android child device, no auth)
CREATE OR REPLACE FUNCTION public.request_extra_time(p_child_id uuid, p_reason text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_parent_id uuid;
  v_request_id uuid;
BEGIN
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

-- RPC: respond_time_request (called by parent)
CREATE OR REPLACE FUNCTION public.respond_time_request(p_request_id uuid, p_approved boolean, p_minutes int DEFAULT 15)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_request RECORD;
BEGIN
  SELECT * INTO v_request FROM time_extension_requests
  WHERE id = p_request_id AND parent_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'REQUEST_NOT_FOUND');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_RESPONDED');
  END IF;

  -- Update request status
  UPDATE time_extension_requests
  SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
      responded_at = now()
  WHERE id = p_request_id;

  -- If approved, grant bonus time using existing mechanism
  IF p_approved THEN
    INSERT INTO bonus_time_grants (child_id, bonus_minutes, granted_by, grant_date)
    VALUES (
      v_request.child_id,
      p_minutes,
      auth.uid(),
      (now() AT TIME ZONE 'Asia/Jerusalem')::date
    );

    -- Send REFRESH_SETTINGS to device
    INSERT INTO device_commands (device_id, command_type, status)
    SELECT d.device_id, 'REFRESH_SETTINGS', 'PENDING'
    FROM devices d
    WHERE d.child_id = v_request.child_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END);
END;
$$;
