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
  CASE
    WHEN peer_child.id IS NOT NULL THEN 'child'
    WHEN peer_parent.id IS NOT NULL THEN 'parent'
    ELSE 'unknown'
  END AS peer_type,
  COALESCE(peer_child.name, peer_parent.full_name, 'משתמש') AS peer_name
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
LEFT JOIN public.children peer_child
  ON peer_child.id = CASE
    WHEN self.device_child_id = f.requester_id THEN f.receiver_id
    ELSE f.requester_id
  END
LEFT JOIN public.parents peer_parent
  ON peer_parent.id = CASE
    WHEN self.device_child_id = f.requester_id THEN f.receiver_id
    ELSE f.requester_id
  END;

GRANT SELECT ON public.view_child_active_chats TO anon, authenticated;

NOTIFY pgrst, 'reload schema';