CREATE OR REPLACE FUNCTION public.complete_chore(p_chore_id uuid, p_photo_base64 text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_chore RECORD;
BEGIN
  SELECT * INTO v_chore FROM chores WHERE id = p_chore_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CHORE_NOT_FOUND');
  END IF;

  IF v_chore.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'current_status', v_chore.status);
  END IF;

  UPDATE chores
  SET status = 'completed_by_child',
      completed_at = now(),
      proof_photo_base64 = p_photo_base64
  WHERE id = p_chore_id;

  RETURN jsonb_build_object('success', true, 'chore_id', p_chore_id);
END;
$$;