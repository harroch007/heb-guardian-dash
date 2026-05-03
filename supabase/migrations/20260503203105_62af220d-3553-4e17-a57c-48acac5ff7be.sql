
-- 1) send_chat_message: server-side sender resolution
CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_friendship_id uuid,
  p_content text,
  p_message_type text DEFAULT 'text',
  p_is_view_once boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid;
  v_id uuid;
BEGIN
  v_sender := public.current_chat_participant_id();
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  IF p_content IS NULL OR length(btrim(p_content)) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CONTENT' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_caller_in_friendship(p_friendship_id) THEN
    RAISE EXCEPTION 'NOT_IN_FRIENDSHIP' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.chat_messages
    (friendship_id, sender_id, content, message_type, is_view_once)
  VALUES
    (p_friendship_id, v_sender, p_content,
     COALESCE(p_message_type, 'text'),
     COALESCE(p_is_view_once, false))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, text, text, boolean)
  TO authenticated, anon;

-- 2) list_my_chats: return the caller's active chats with last message + unread
CREATE OR REPLACE FUNCTION public.list_my_chats()
RETURNS TABLE (
  friendship_id uuid,
  peer_id uuid,
  peer_name text,
  peer_type text,
  last_message text,
  last_message_type text,
  last_message_at timestamptz,
  unread_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
BEGIN
  v_me := public.current_chat_participant_id();
  IF v_me IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH my_friendships AS (
    SELECT
      f.id AS fid,
      CASE WHEN f.requester_id = v_me THEN f.receiver_id ELSE f.requester_id END AS peer
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (f.requester_id = v_me OR f.receiver_id = v_me)
  ),
  last_msgs AS (
    SELECT DISTINCT ON (m.friendship_id)
      m.friendship_id, m.content, m.message_type, m.created_at
    FROM public.chat_messages m
    WHERE m.friendship_id IN (SELECT fid FROM my_friendships)
    ORDER BY m.friendship_id, m.created_at DESC
  ),
  receipts AS (
    SELECT r.friendship_id, r.last_read_at
    FROM public.chat_read_receipts r
    WHERE r.participant_id = v_me
  )
  SELECT
    mf.fid,
    mf.peer,
    COALESCE(cp.display_name,
             (SELECT c.name FROM public.children c WHERE c.id = mf.peer),
             (SELECT p.full_name FROM public.parents p WHERE p.id = mf.peer)) AS peer_name,
    COALESCE(cp.participant_type,
             CASE WHEN EXISTS (SELECT 1 FROM public.children c WHERE c.id = mf.peer)
                  THEN 'child' ELSE 'parent' END) AS peer_type,
    lm.content,
    lm.message_type,
    lm.created_at,
    (
      SELECT COUNT(*)::int
      FROM public.chat_messages m2
      WHERE m2.friendship_id = mf.fid
        AND m2.sender_id <> v_me
        AND m2.created_at > COALESCE((SELECT r.last_read_at FROM receipts r WHERE r.friendship_id = mf.fid),
                                     'epoch'::timestamptz)
    ) AS unread_count
  FROM my_friendships mf
  LEFT JOIN public.chat_participants cp ON cp.participant_id = mf.peer
  LEFT JOIN last_msgs lm ON lm.friendship_id = mf.fid
  ORDER BY lm.created_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_chats() TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
