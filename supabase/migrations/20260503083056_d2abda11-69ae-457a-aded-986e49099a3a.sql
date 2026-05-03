
-- ============================================================
-- UNIVERSAL CHAT — Phase 1: Schema, RLS, Auto-friendship
-- ============================================================

-- ------------------------------------------------------------
-- 1. Drop strict child-only FKs (parents can now participate)
-- ------------------------------------------------------------
ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_sender_id_fkey;

ALTER TABLE public.friendships
  DROP CONSTRAINT IF EXISTS friendships_requester_id_fkey;

ALTER TABLE public.friendships
  DROP CONSTRAINT IF EXISTS friendships_receiver_id_fkey;

-- Unique pair index to prevent duplicate friendships (regardless of order)
CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_unique_pair
  ON public.friendships (
    LEAST(requester_id, receiver_id),
    GREATEST(requester_id, receiver_id)
  );

-- ------------------------------------------------------------
-- 2. chat_participants VIEW (children + parents unified)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.chat_participants
WITH (security_invoker = on)
AS
SELECT
  c.id              AS participant_id,
  'child'::text     AS participant_type,
  c.name            AS display_name,
  c.parent_id       AS owner_parent_id
FROM public.children c
UNION ALL
SELECT
  p.id              AS participant_id,
  'parent'::text    AS participant_type,
  COALESCE(p.full_name, 'הורה') AS display_name,
  p.id              AS owner_parent_id
FROM public.parents p;

GRANT SELECT ON public.chat_participants TO anon, authenticated;

-- ------------------------------------------------------------
-- 3. chat_read_receipts table (unread counters)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  friendship_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (friendship_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_read_receipts_participant
  ON public.chat_read_receipts(participant_id);

ALTER TABLE public.chat_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_read_receipts REPLICA IDENTITY FULL;

-- ------------------------------------------------------------
-- 4. Helper functions (SECURITY DEFINER, no recursion)
-- ------------------------------------------------------------

-- Check if a participant id is in a given friendship (any status)
CREATE OR REPLACE FUNCTION public.is_participant_in_friendship(
  p_participant_id uuid,
  p_friendship_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.id = p_friendship_id
      AND f.status = 'accepted'
      AND (f.requester_id = p_participant_id OR f.receiver_id = p_participant_id)
  );
$$;

-- Is the calling user (parent via auth.uid OR child via device JWT) acting as this participant?
CREATE OR REPLACE FUNCTION public.is_calling_user_participant(
  p_participant_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Parent acting as themselves
    (auth.uid() IS NOT NULL AND auth.uid() = p_participant_id)
    OR
    -- Child acting via device JWT
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.device_id = public.get_device_id_from_jwt()
        AND d.child_id = p_participant_id
    );
$$;

-- Is the calling user (parent OR child) a participant in this friendship?
CREATE OR REPLACE FUNCTION public.is_calling_user_in_friendship(
  p_friendship_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.id = p_friendship_id
      AND f.status = 'accepted'
      AND (
        -- Parent participant matches auth.uid()
        (auth.uid() IS NOT NULL AND (f.requester_id = auth.uid() OR f.receiver_id = auth.uid()))
        OR
        -- Child participant matches device JWT
        EXISTS (
          SELECT 1 FROM public.devices d
          WHERE d.device_id = public.get_device_id_from_jwt()
            AND (d.child_id = f.requester_id OR d.child_id = f.receiver_id)
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_participant_in_friendship(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_calling_user_participant(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_calling_user_in_friendship(uuid) TO anon, authenticated;

-- ------------------------------------------------------------
-- 5. Update RLS — chat_messages (replace child-only with universal)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Child device can insert chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Child device can read chat messages" ON public.chat_messages;

CREATE POLICY "Participant can insert chat messages"
ON public.chat_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  public.is_calling_user_participant(sender_id)
  AND public.is_participant_in_friendship(sender_id, friendship_id)
);

CREATE POLICY "Participant can read chat messages"
ON public.chat_messages
FOR SELECT
TO anon, authenticated
USING (
  public.is_calling_user_in_friendship(friendship_id)
);

-- ------------------------------------------------------------
-- 6. RLS — friendships (parents need to see/create their own)
-- ------------------------------------------------------------
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participant can read own friendships" ON public.friendships;
CREATE POLICY "Participant can read own friendships"
ON public.friendships
FOR SELECT
TO anon, authenticated
USING (
  public.is_calling_user_participant(requester_id)
  OR public.is_calling_user_participant(receiver_id)
);

DROP POLICY IF EXISTS "Authenticated can create own friendships" ON public.friendships;
CREATE POLICY "Authenticated can create own friendships"
ON public.friendships
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (auth.uid() = requester_id OR auth.uid() = receiver_id)
);

DROP POLICY IF EXISTS "Participant can update own friendships" ON public.friendships;
CREATE POLICY "Participant can update own friendships"
ON public.friendships
FOR UPDATE
TO authenticated
USING (
  public.is_calling_user_participant(requester_id)
  OR public.is_calling_user_participant(receiver_id)
);

-- ------------------------------------------------------------
-- 7. RLS — chat_read_receipts
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Participant can manage own read receipts" ON public.chat_read_receipts;
CREATE POLICY "Participant can manage own read receipts"
ON public.chat_read_receipts
FOR ALL
TO anon, authenticated
USING (
  public.is_calling_user_participant(participant_id)
)
WITH CHECK (
  public.is_calling_user_participant(participant_id)
  AND public.is_participant_in_friendship(participant_id, friendship_id)
);

-- ------------------------------------------------------------
-- 8. Update media_views RLS to allow parents too
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Child device can mark media viewed" ON public.media_views;
CREATE POLICY "Participant can mark media viewed"
ON public.media_views
FOR INSERT
TO anon, authenticated
WITH CHECK (
  public.is_calling_user_participant(viewer_id)
  AND EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.id = media_views.message_id
      AND m.is_view_once = true
      AND m.message_type IN ('image','voice')
      AND m.sender_id <> media_views.viewer_id
      AND public.is_participant_in_friendship(media_views.viewer_id, m.friendship_id)
  )
);

DROP POLICY IF EXISTS "Child device can read media views" ON public.media_views;
CREATE POLICY "Participant can read media views"
ON public.media_views
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.id = media_views.message_id
      AND public.is_calling_user_in_friendship(m.friendship_id)
  )
);

-- ------------------------------------------------------------
-- 9. Storage RLS — allow parents to upload too
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Child device can upload chat media" ON storage.objects;
CREATE POLICY "Participant can upload chat media"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND public.is_calling_user_in_friendship(
    ((storage.foldername(name))[1])::uuid
  )
);

-- ------------------------------------------------------------
-- 10. Auto-friendship trigger: parent <-> child
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_parent_child_friendship()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.friendships (requester_id, receiver_id, status, responded_at)
  VALUES (NEW.parent_id, NEW.id, 'accepted', now())
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_parent_child_friendship ON public.children;
CREATE TRIGGER trg_create_parent_child_friendship
AFTER INSERT ON public.children
FOR EACH ROW
EXECUTE FUNCTION public.create_parent_child_friendship();

-- ------------------------------------------------------------
-- 11. Backfill: create friendships for all existing children
-- ------------------------------------------------------------
INSERT INTO public.friendships (requester_id, receiver_id, status, responded_at)
SELECT c.parent_id, c.id, 'accepted', now()
FROM public.children c
WHERE c.parent_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 12. Realtime
-- ------------------------------------------------------------
ALTER TABLE public.friendships REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_read_receipts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';
