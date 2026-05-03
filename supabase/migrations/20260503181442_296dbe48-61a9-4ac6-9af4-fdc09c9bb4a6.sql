
-- ============================================================
-- Universal participant resolver (returns child.id or parent.id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_chat_participant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- If caller is a paired device, return the child_id linked to that auth user
    (SELECT d.child_id FROM public.devices d WHERE d.auth_user_id = auth.uid() LIMIT 1),
    -- Otherwise the caller is a parent; their auth.uid() IS parents.id
    auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_chat_participant_id() TO anon, authenticated;

-- ============================================================
-- Helper: is the calling user a participant in friendship X?
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_caller_in_friendship(p_friendship_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.id = p_friendship_id
      AND public.current_chat_participant_id() IN (f.requester_id, f.receiver_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_caller_in_friendship(uuid) TO anon, authenticated;

-- ============================================================
-- Refresh chat_messages policies
-- ============================================================
DROP POLICY IF EXISTS "Participant can read chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Participant can insert chat messages" ON public.chat_messages;

CREATE POLICY "Participant can read chat messages"
  ON public.chat_messages FOR SELECT
  TO anon, authenticated
  USING (public.is_caller_in_friendship(friendship_id));

CREATE POLICY "Participant can insert chat messages"
  ON public.chat_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    sender_id = public.current_chat_participant_id()
    AND public.is_caller_in_friendship(friendship_id)
  );

-- ============================================================
-- Refresh chat_read_receipts policy
-- ============================================================
DROP POLICY IF EXISTS "Participant can manage own read receipts" ON public.chat_read_receipts;

CREATE POLICY "Participant can manage own read receipts"
  ON public.chat_read_receipts FOR ALL
  TO anon, authenticated
  USING (participant_id = public.current_chat_participant_id())
  WITH CHECK (
    participant_id = public.current_chat_participant_id()
    AND public.is_caller_in_friendship(friendship_id)
  );

-- ============================================================
-- friendships SELECT policy (so each side can read its rows)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'friendships' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

DROP POLICY IF EXISTS "Caller can read own friendships" ON public.friendships;
CREATE POLICY "Caller can read own friendships"
  ON public.friendships FOR SELECT
  TO anon, authenticated
  USING (
    public.current_chat_participant_id() IN (requester_id, receiver_id)
  );

NOTIFY pgrst, 'reload schema';
