
CREATE OR REPLACE FUNCTION public.respond_time_request(p_request_id uuid, p_approved boolean, p_minutes integer DEFAULT 15)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request RECORD;
  v_caller uuid := auth.uid();
  v_is_owner boolean;
  v_is_coparent boolean;
BEGIN
  SELECT * INTO v_request FROM time_extension_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'REQUEST_NOT_FOUND');
  END IF;

  v_is_owner := EXISTS (
    SELECT 1 FROM children WHERE id = v_request.child_id AND parent_id = v_caller
  );

  v_is_coparent := EXISTS (
    SELECT 1 FROM children c
    JOIN family_members fm ON fm.owner_id = c.parent_id
    WHERE c.id = v_request.child_id
      AND fm.member_id = v_caller
      AND fm.status = 'accepted'
  );

  IF NOT v_is_owner AND NOT v_is_coparent THEN
    RETURN jsonb_build_object('success', false, 'error', 'REQUEST_NOT_FOUND');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_RESPONDED');
  END IF;

  UPDATE time_extension_requests
  SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
      responded_at = now()
  WHERE id = p_request_id;

  IF p_approved THEN
    INSERT INTO bonus_time_grants (child_id, bonus_minutes, granted_by, grant_date)
    VALUES (
      v_request.child_id,
      p_minutes,
      v_caller,
      (now() AT TIME ZONE 'Asia/Jerusalem')::date
    );
  END IF;

  -- REFRESH_SETTINGS for BOTH approve and reject
  INSERT INTO device_commands (device_id, command_type, status)
  SELECT d.device_id, 'REFRESH_SETTINGS', 'PENDING'
  FROM devices d
  WHERE d.child_id = v_request.child_id;

  RETURN jsonb_build_object('success', true, 'status', CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END);
END;
$function$;
