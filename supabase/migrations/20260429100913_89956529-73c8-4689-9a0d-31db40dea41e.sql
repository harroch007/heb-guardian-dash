-- ============================================================
-- STAGE 2: Internal child-to-child chat with privacy rules
-- ============================================================

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- 1. STORAGE BUCKET (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. TABLES
-- ============================================================

-- chat_messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  friendship_id uuid NOT NULL REFERENCES public.friendships(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  message_type text NOT NULL CHECK (message_type IN ('text','image','voice')),
  content text NOT NULL,
  is_view_once boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_friendship_created
  ON public.chat_messages(friendship_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender
  ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
  ON public.chat_messages(created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- View-once allowed only for media
CREATE OR REPLACE FUNCTION public.chat_messages_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.message_type = 'text' AND NEW.is_view_once = true THEN
    RAISE EXCEPTION 'VIEW_ONCE_TEXT_NOT_ALLOWED' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_chat_messages_validate ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_validate
BEFORE INSERT OR UPDATE ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.chat_messages_validate();

-- media_views
CREATE TABLE IF NOT EXISTS public.media_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_media_views_message ON public.media_views(message_id);
CREATE INDEX IF NOT EXISTS idx_media_views_viewer ON public.media_views(viewer_id);

ALTER TABLE public.media_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_views REPLICA IDENTITY FULL;

-- ============================================================
-- 3. HELPER FUNCTIONS
-- ============================================================

-- Is given child a participant in given friendship (accepted)?
CREATE OR REPLACE FUNCTION public.is_child_in_friendship(
  p_child_id uuid,
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
      AND (f.requester_id = p_child_id OR f.receiver_id = p_child_id)
  );
$$;

-- Is the calling device's child a participant in the given friendship?
CREATE OR REPLACE FUNCTION public.is_calling_device_in_friendship(
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
    JOIN public.devices d
      ON d.device_id = public.get_device_id_from_jwt()
     AND (d.child_id = f.requester_id OR d.child_id = f.receiver_id)
    WHERE f.id = p_friendship_id
      AND f.status = 'accepted'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_child_in_friendship(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_calling_device_in_friendship(uuid) TO anon, authenticated;

-- ============================================================
-- 4. RLS POLICIES — chat_messages
-- ============================================================

DROP POLICY IF EXISTS "Child device can insert chat messages" ON public.chat_messages;
CREATE POLICY "Child device can insert chat messages"
ON public.chat_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  public.is_child_of_calling_device(sender_id)
  AND public.is_child_in_friendship(sender_id, friendship_id)
);

DROP POLICY IF EXISTS "Child device can read chat messages" ON public.chat_messages;
CREATE POLICY "Child device can read chat messages"
ON public.chat_messages
FOR SELECT
TO anon, authenticated
USING (
  public.is_calling_device_in_friendship(friendship_id)
);

-- Service role bypasses RLS automatically; explicit policy not needed for cron.

-- Admins (parents) view nothing on the chat content per privacy design.
-- Intentionally NO policy for parents/admins on chat_messages.

-- ============================================================
-- 5. RLS POLICIES — media_views
-- ============================================================

DROP POLICY IF EXISTS "Child device can mark media viewed" ON public.media_views;
CREATE POLICY "Child device can mark media viewed"
ON public.media_views
FOR INSERT
TO anon, authenticated
WITH CHECK (
  public.is_child_of_calling_device(viewer_id)
  AND EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.id = media_views.message_id
      AND m.is_view_once = true
      AND m.message_type IN ('image','voice')
      AND m.sender_id <> media_views.viewer_id
      AND public.is_child_in_friendship(media_views.viewer_id, m.friendship_id)
  )
);

DROP POLICY IF EXISTS "Child device can read media views" ON public.media_views;
CREATE POLICY "Child device can read media views"
ON public.media_views
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.id = media_views.message_id
      AND public.is_calling_device_in_friendship(m.friendship_id)
  )
);

-- ============================================================
-- 6. STORAGE RLS for chat-media bucket
-- ============================================================

DROP POLICY IF EXISTS "Child device can upload chat media" ON storage.objects;
CREATE POLICY "Child device can upload chat media"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND public.is_calling_device_in_friendship(
    ((storage.foldername(name))[1])::uuid
  )
);

-- Direct read forbidden — RPC issues short-lived signed URLs.
DROP POLICY IF EXISTS "Block direct read of chat media" ON storage.objects;
-- (no SELECT policy means no read access for anon/authenticated)

-- ============================================================
-- 7. RPCs
-- ============================================================

-- Send a chat message
CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_sender_id uuid,
  p_friendship_id uuid,
  p_message_type text,
  p_content text,
  p_is_view_once boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_child_of_calling_device(p_sender_id) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_child_in_friendship(p_sender_id, p_friendship_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FRIENDS',
      'message_he', 'אינכם חברים');
  END IF;

  IF p_message_type NOT IN ('text','image','voice') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TYPE',
      'message_he', 'סוג הודעה לא תקין');
  END IF;

  IF p_message_type = 'text' AND COALESCE(p_is_view_once, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'VIEW_ONCE_TEXT',
      'message_he', 'אי אפשר לשלוח טקסט בצפייה אחת');
  END IF;

  IF p_content IS NULL OR length(trim(p_content)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'EMPTY_CONTENT',
      'message_he', 'תוכן ריק');
  END IF;

  INSERT INTO public.chat_messages
    (friendship_id, sender_id, message_type, content, is_view_once)
  VALUES
    (p_friendship_id, p_sender_id, p_message_type, p_content,
     COALESCE(p_is_view_once, false))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'message_id', v_id);
END
$$;

-- Get a chat thread (paginated, view-once aware)
CREATE OR REPLACE FUNCTION public.get_chat_thread(
  p_child_id uuid,
  p_friendship_id uuid,
  p_limit int DEFAULT 50,
  p_before timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  sender_id uuid,
  message_type text,
  content text,
  signed_url text,
  is_view_once boolean,
  consumed boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  IF NOT public.is_child_of_calling_device(p_child_id) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_child_in_friendship(p_child_id, p_friendship_id) THEN
    RAISE EXCEPTION 'NOT_FRIENDS' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH thread AS (
    SELECT m.*,
           EXISTS (
             SELECT 1 FROM public.media_views v
             WHERE v.message_id = m.id AND v.viewer_id = p_child_id
           ) AS viewer_consumed
    FROM public.chat_messages m
    WHERE m.friendship_id = p_friendship_id
      AND (p_before IS NULL OR m.created_at < p_before)
    ORDER BY m.created_at DESC
    LIMIT v_limit
  )
  SELECT
    t.id,
    t.sender_id,
    t.message_type,
    -- TEXT: always returned
    -- view-once media: hide content for non-sender if consumed
    CASE
      WHEN t.message_type = 'text' THEN t.content
      WHEN t.sender_id = p_child_id THEN t.content
      WHEN t.is_view_once AND t.viewer_consumed THEN NULL
      ELSE t.content
    END AS content,
    -- Signed URL for media (only when not consumed by viewer, or viewer is sender)
    CASE
      WHEN t.message_type IN ('image','voice')
       AND ((t.sender_id = p_child_id) OR NOT (t.is_view_once AND t.viewer_consumed))
      THEN (
        SELECT (signed_url_payload).signed_url
        FROM extensions.storage_create_signed_url('chat-media', t.content, 60)
          AS signed_url_payload
      )
      ELSE NULL
    END AS signed_url,
    t.is_view_once,
    t.viewer_consumed AS consumed,
    t.created_at
  FROM thread t;
EXCEPTION WHEN undefined_function THEN
  -- Fallback if storage_create_signed_url helper isn't available in this shape;
  -- return content path and let client request signed URL via storage RPC.
  RETURN QUERY
  WITH thread AS (
    SELECT m.*,
           EXISTS (
             SELECT 1 FROM public.media_views v
             WHERE v.message_id = m.id AND v.viewer_id = p_child_id
           ) AS viewer_consumed
    FROM public.chat_messages m
    WHERE m.friendship_id = p_friendship_id
      AND (p_before IS NULL OR m.created_at < p_before)
    ORDER BY m.created_at DESC
    LIMIT v_limit
  )
  SELECT
    t.id,
    t.sender_id,
    t.message_type,
    CASE
      WHEN t.message_type = 'text' THEN t.content
      WHEN t.sender_id = p_child_id THEN t.content
      WHEN t.is_view_once AND t.viewer_consumed THEN NULL
      ELSE t.content
    END AS content,
    NULL::text AS signed_url,
    t.is_view_once,
    t.viewer_consumed AS consumed,
    t.created_at
  FROM thread t;
END
$$;

-- Mark media as viewed (view-once burn)
CREATE OR REPLACE FUNCTION public.mark_media_viewed(
  p_viewer_id uuid,
  p_message_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF v_msg.sender_id = p_viewer_id THEN
    RETURN jsonb_build_object('success', true, 'consumed', false,
      'message_he', 'השולח לא נחשב כצופה');
  END IF;

  IF NOT v_msg.is_view_once OR v_msg.message_type NOT IN ('image','voice') THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_VIEW_ONCE');
  END IF;

  INSERT INTO public.media_views (message_id, viewer_id)
  VALUES (p_message_id, p_viewer_id)
  ON CONFLICT (message_id, viewer_id) DO NOTHING;

  -- Immediate burn: delete the storage object and message row.
  -- Storage cleanup of the file
  DELETE FROM storage.objects
  WHERE bucket_id = 'chat-media'
    AND name = v_msg.content;

  DELETE FROM public.chat_messages WHERE id = p_message_id;

  RETURN jsonb_build_object('success', true, 'consumed', true);
END
$$;

-- Manual delete of all chat history in a friendship
CREATE OR REPLACE FUNCTION public.delete_friendship_chat(
  p_child_id uuid,
  p_friendship_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  IF NOT public.is_child_of_calling_device(p_child_id) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_child_in_friendship(p_child_id, p_friendship_id) THEN
    RAISE EXCEPTION 'NOT_FRIENDS' USING ERRCODE = '42501';
  END IF;

  -- Remove media files first
  DELETE FROM storage.objects
  WHERE bucket_id = 'chat-media'
    AND name IN (
      SELECT content FROM public.chat_messages
      WHERE friendship_id = p_friendship_id
        AND message_type IN ('image','voice')
    );

  DELETE FROM public.chat_messages
  WHERE friendship_id = p_friendship_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'deleted', v_deleted);
END
$$;

GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid,uuid,text,text,boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_thread(uuid,uuid,int,timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_media_viewed(uuid,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_friendship_chat(uuid,uuid) TO anon, authenticated;

-- ============================================================
-- 8. PURGE FUNCTIONS (cron-driven)
-- ============================================================

-- Backup burn for any consumed view-once media that wasn't immediate-deleted
CREATE OR REPLACE FUNCTION public.purge_consumed_view_once_media()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT m.id, m.content
    FROM public.chat_messages m
    JOIN public.media_views v
      ON v.message_id = m.id
     AND v.viewer_id <> m.sender_id
    WHERE m.is_view_once = true
      AND m.message_type IN ('image','voice')
  LOOP
    DELETE FROM storage.objects
    WHERE bucket_id = 'chat-media' AND name = r.content;
    DELETE FROM public.chat_messages WHERE id = r.id;
  END LOOP;
END
$$;

-- 30-day TTL purge
CREATE OR REPLACE FUNCTION public.purge_expired_chat_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete media files for expired messages
  DELETE FROM storage.objects
  WHERE bucket_id = 'chat-media'
    AND name IN (
      SELECT content FROM public.chat_messages
      WHERE created_at < (now() - interval '30 days')
        AND message_type IN ('image','voice')
    );

  DELETE FROM public.chat_messages
  WHERE created_at < (now() - interval '30 days');

  -- Orphan storage cleanup: any object whose path's friendship_id no longer
  -- has any message referencing it AND is older than 30 days.
  DELETE FROM storage.objects o
  WHERE o.bucket_id = 'chat-media'
    AND o.created_at < (now() - interval '30 days')
    AND NOT EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.content = o.name
    );
END
$$;

-- ============================================================
-- 9. CRON JOBS
-- ============================================================

-- Unschedule existing jobs with the same names (idempotent)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT jobname FROM cron.job
    WHERE jobname IN (
      'chat-purge-expired-daily',
      'chat-purge-view-once-5min'
    )
  LOOP
    PERFORM cron.unschedule(r.jobname);
  END LOOP;
END $$;

-- Daily at 03:00 Asia/Jerusalem (00:00 UTC in winter, 00:00 UTC ≈ 02:00 IST DST).
-- Using 00:00 UTC as a stable schedule that lands in the Israeli early morning year-round.
SELECT cron.schedule(
  'chat-purge-expired-daily',
  '0 0 * * *',
  $$ SELECT public.purge_expired_chat_messages(); $$
);

-- Backup view-once burn every 5 minutes
SELECT cron.schedule(
  'chat-purge-view-once-5min',
  '*/5 * * * *',
  $$ SELECT public.purge_consumed_view_once_media(); $$
);

-- ============================================================
-- 10. REALTIME PUBLICATION
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'media_views'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.media_views';
  END IF;
END $$;

-- ============================================================
-- 11. PostgREST schema reload
-- ============================================================
NOTIFY pgrst, 'reload schema';
