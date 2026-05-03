-- Helper: resolve a chat peer's display name + type without exposing parents/children tables
CREATE OR REPLACE FUNCTION public.get_chat_peer_info(p_participant_id uuid)
RETURNS TABLE (peer_type text, peer_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'child'::text, c.name
  FROM public.children c
  WHERE c.id = p_participant_id
  UNION ALL
  SELECT 'parent'::text, COALESCE(pa.full_name, 'הורה')
  FROM public.parents pa
  WHERE pa.id = p_participant_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_peer_info(uuid) TO anon, authenticated;

DROP VIEW IF EXISTS public.view_child_active_chats;

CREATE VIEW public.view_child_active_chats
WITH (security_invoker = on) AS
SELECT
  f.id AS friendship_id,
  f.requester_id,
  f.receiver_id,
  f.status,
  f.created_at,
  CASE
    WHEN self.device_child_id = f.requester_id THEN f.receiver_id
    ELSE f.requester_id
  END AS peer_id,
  info.peer_type,
  COALESCE(info.peer_name, 'משתמש') AS peer_name
FROM public.friendships f
JOIN LATERAL (
  SELECT d.child_id AS device_child_id
  FROM public.devices d
  WHERE d.device_id = public.get_device_id_from_jwt()
    AND d.child_id IS NOT NULL
  LIMIT 1
) self ON (
  f.status = 'accepted'
  AND (f.requester_id = self.device_child_id OR f.receiver_id = self.device_child_id)
)
LEFT JOIN LATERAL public.get_chat_peer_info(
  CASE
    WHEN self.device_child_id = f.requester_id THEN f.receiver_id
    ELSE f.requester_id
  END
) info ON true;

GRANT SELECT ON public.view_child_active_chats TO anon, authenticated;

NOTIFY pgrst, 'reload schema';