-- Fix view-once burn semantics: sender always sees, only the recipient is blocked.
-- The recipient block is enforced in get_chat_thread via media_views.
-- Therefore, do NOT delete the message row or storage file on view.
-- Physical deletion happens after 30 days via purge_expired_chat_messages.

CREATE OR REPLACE FUNCTION public.mark_media_viewed(p_viewer_id uuid, p_message_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_msg record;
BEGIN
  IF NOT public.is_child_of_calling_device(p_viewer_id) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_msg FROM public.chat_messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT public.is_child_in_friendship(p_viewer_id, v_msg.friendship_id) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  -- Sender opening their own media is not a "view" event
  IF v_msg.sender_id = p_viewer_id THEN
    RETURN jsonb_build_object('success', true, 'consumed', false,
      'message_he', 'השולח לא נחשב כצופה');
  END IF;

  IF NOT v_msg.is_view_once OR v_msg.message_type NOT IN ('image','voice') THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_VIEW_ONCE');
  END IF;

  -- Record the view (idempotent). The recipient will be blocked from
  -- fetching the signed URL on subsequent get_chat_thread calls.
  -- Sender retains access until 30-day TTL purge.
  INSERT INTO public.media_views (message_id, viewer_id)
  VALUES (p_message_id, p_viewer_id)
  ON CONFLICT (message_id, viewer_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'consumed', true);
END
$function$;

-- Disable the immediate-burn cron job; rely on 30-day TTL for physical deletion
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'chat-purge-view-once-5min') THEN
    PERFORM cron.unschedule('chat-purge-view-once-5min');
  END IF;
END $$;

-- Drop the now-unused immediate burn helper to avoid accidental use
DROP FUNCTION IF EXISTS public.purge_consumed_view_once_media();

NOTIFY pgrst, 'reload schema';