DROP FUNCTION IF EXISTS public.get_child_friends(uuid);

CREATE OR REPLACE FUNCTION public.get_child_friends(p_child_id uuid)
RETURNS TABLE (
  friendship_id     uuid,
  friend_id         uuid,
  friend_child_id   uuid,
  friend_name       text,
  friend_kippy_tag  text,
  participant_type  text,
  status            text,
  created_at        timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_child_of_calling_device(p_child_id) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH peer AS (
    SELECT
      f.id AS fid,
      CASE WHEN f.requester_id = p_child_id THEN f.receiver_id
           ELSE f.requester_id END AS peer_id,
      f.status     AS raw_status,
      f.requester_id,
      f.created_at
    FROM public.friendships f
    WHERE f.requester_id = p_child_id OR f.receiver_id = p_child_id
  )
  SELECT
    p.fid                                            AS friendship_id,
    p.peer_id                                        AS friend_id,
    c.id                                             AS friend_child_id,
    COALESCE(c.name, pa.full_name, 'משתמש')          AS friend_name,
    c.kippy_tag                                      AS friend_kippy_tag,
    CASE
      WHEN c.id  IS NOT NULL THEN 'child'
      WHEN pa.id IS NOT NULL THEN 'parent'
      ELSE 'unknown'
    END                                              AS participant_type,
    CASE
      WHEN p.raw_status = 'accepted' THEN 'accepted'
      WHEN p.raw_status = 'declined' THEN 'declined'
      WHEN p.requester_id = p_child_id THEN 'pending_outgoing'
      ELSE 'pending_incoming'
    END                                              AS status,
    p.created_at
  FROM peer p
  LEFT JOIN public.children c  ON c.id  = p.peer_id
  LEFT JOIN public.parents  pa ON pa.id = p.peer_id
  ORDER BY p.created_at DESC;
END
$$;

GRANT EXECUTE ON FUNCTION public.get_child_friends(uuid) TO anon, authenticated;

DROP VIEW IF EXISTS public.view_child_active_chats;

CREATE VIEW public.view_child_active_chats
WITH (security_invoker = on) AS
SELECT
  f.id            AS friendship_id,
  f.requester_id,
  f.receiver_id,
  f.status,
  f.created_at,
  cp.participant_id   AS peer_id,
  cp.participant_type AS peer_type,
  cp.display_name     AS peer_name
FROM public.friendships f
JOIN public.chat_participants cp
  ON cp.participant_id IN (f.requester_id, f.receiver_id)
WHERE f.status = 'accepted';

GRANT SELECT ON public.view_child_active_chats TO anon, authenticated;

NOTIFY pgrst, 'reload schema';