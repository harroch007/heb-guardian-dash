
CREATE OR REPLACE FUNCTION public.retry_failed_queue_items()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INT;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE alert_events_queue
  SET status = 'pending',
      attempt = 0,
      last_error = NULL,
      visible_at = now(),
      updated_at = now()
  WHERE status = 'failed';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'reset_count', v_count);
END;
$$;
