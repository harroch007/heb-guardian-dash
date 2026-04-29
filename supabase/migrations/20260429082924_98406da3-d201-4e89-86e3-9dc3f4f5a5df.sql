-- 1. KIPPY TAG ON CHILDREN
ALTER TABLE public.children ADD COLUMN IF NOT EXISTS kippy_tag text;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_children_kippy_tag
  ON public.children(kippy_tag) WHERE kippy_tag IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_kippy_tag()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
  alen int := length(alphabet);
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..6 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random()*alen)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.children WHERE kippy_tag = candidate);
  END LOOP;
  RETURN candidate;
END
$$;

CREATE OR REPLACE FUNCTION public.set_kippy_tag_if_missing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.kippy_tag IS NULL OR NEW.kippy_tag = '' THEN
    NEW.kippy_tag := public.generate_kippy_tag();
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_set_kippy_tag ON public.children;
CREATE TRIGGER trg_set_kippy_tag
BEFORE INSERT ON public.children
FOR EACH ROW EXECUTE FUNCTION public.set_kippy_tag_if_missing();

UPDATE public.children
SET kippy_tag = public.generate_kippy_tag()
WHERE kippy_tag IS NULL;

-- 2. DEVICE OWNERSHIP HELPER
CREATE OR REPLACE FUNCTION public.is_child_of_calling_device(p_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.devices d
    WHERE d.child_id = p_child_id
      AND d.device_id = public.get_device_id_from_jwt()
  );
$$;

-- 3. FRIENDSHIPS TABLE
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  receiver_id  uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT chk_no_self_friend CHECK (requester_id <> receiver_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_friendship_pair
  ON public.friendships (
    LEAST(requester_id, receiver_id),
    GREATEST(requester_id, receiver_id)
  );

CREATE INDEX IF NOT EXISTS idx_friendships_receiver ON public.friendships(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships(status);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships REPLICA IDENTITY FULL;

-- 4. RLS POLICIES
DROP POLICY IF EXISTS "Parents can view their children friendships" ON public.friendships;
CREATE POLICY "Parents can view their children friendships"
ON public.friendships FOR SELECT TO authenticated
USING (is_family_parent(requester_id) OR is_family_parent(receiver_id));

DROP POLICY IF EXISTS "Admins can view all friendships" ON public.friendships;
CREATE POLICY "Admins can view all friendships"
ON public.friendships FOR SELECT TO authenticated
USING (is_admin());

DROP POLICY IF EXISTS "Child device can read its own friendships" ON public.friendships;
CREATE POLICY "Child device can read its own friendships"
ON public.friendships FOR SELECT TO anon, authenticated
USING (
  is_child_of_calling_device(requester_id) OR
  is_child_of_calling_device(receiver_id)
);

-- 5. RPCs
CREATE OR REPLACE FUNCTION public.get_my_kippy_tag(p_child_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tag text;
BEGIN
  IF NOT public.is_child_of_calling_device(p_child_id) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT kippy_tag INTO v_tag FROM public.children WHERE id = p_child_id;

  IF v_tag IS NULL THEN
    v_tag := public.generate_kippy_tag();
    UPDATE public.children SET kippy_tag = v_tag WHERE id = p_child_id;
  END IF;

  RETURN v_tag;
END
$$;

CREATE OR REPLACE FUNCTION public.send_friend_request(
  p_requester_child_id uuid,
  p_target_kippy_tag text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receiver_id uuid;
  v_existing record;
  v_new_id uuid;
  v_clean_tag text;
BEGIN
  IF NOT public.is_child_of_calling_device(p_requester_child_id) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  v_clean_tag := upper(trim(coalesce(p_target_kippy_tag, '')));
  IF v_clean_tag = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TAG',
      'message_he', 'תג לא תקין');
  END IF;

  SELECT id INTO v_receiver_id
  FROM public.children
  WHERE upper(kippy_tag) = v_clean_tag;

  IF v_receiver_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND',
      'message_he', 'משתמש לא קיים');
  END IF;

  IF v_receiver_id = p_requester_child_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'SELF',
      'message_he', 'אי אפשר להוסיף את עצמך');
  END IF;

  SELECT * INTO v_existing
  FROM public.friendships
  WHERE (requester_id = p_requester_child_id AND receiver_id = v_receiver_id)
     OR (requester_id = v_receiver_id AND receiver_id = p_requester_child_id)
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.status = 'accepted' THEN
      RETURN jsonb_build_object('success', false, 'error', 'ALREADY_FRIENDS',
        'message_he', 'אתם כבר חברים', 'friendship_id', v_existing.id);
    ELSIF v_existing.status = 'pending' THEN
      IF v_existing.requester_id = p_requester_child_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'ALREADY_PENDING',
          'message_he', 'הבקשה כבר נשלחה', 'friendship_id', v_existing.id);
      ELSE
        UPDATE public.friendships
        SET status = 'accepted', responded_at = now()
        WHERE id = v_existing.id;
        RETURN jsonb_build_object('success', true, 'status', 'accepted',
          'auto_accepted', true, 'friendship_id', v_existing.id);
      END IF;
    ELSIF v_existing.status = 'declined' THEN
      UPDATE public.friendships
      SET requester_id = p_requester_child_id,
          receiver_id  = v_receiver_id,
          status = 'pending',
          created_at = now(),
          responded_at = NULL
      WHERE id = v_existing.id;
      RETURN jsonb_build_object('success', true, 'status', 'pending',
        'friendship_id', v_existing.id);
    END IF;
  END IF;

  INSERT INTO public.friendships (requester_id, receiver_id, status)
  VALUES (p_requester_child_id, v_receiver_id, 'pending')
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'status', 'pending',
    'friendship_id', v_new_id);
END
$$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(
  p_receiver_child_id uuid,
  p_friendship_id uuid,
  p_accept boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  IF NOT public.is_child_of_calling_device(p_receiver_child_id) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.friendships WHERE id = p_friendship_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND',
      'message_he', 'הבקשה לא קיימת');
  END IF;

  IF v_row.receiver_id <> p_receiver_child_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_RECEIVER',
      'message_he', 'אין הרשאה לבקשה זו');
  END IF;

  IF v_row.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_RESPONDED',
      'message_he', 'הבקשה כבר טופלה', 'status', v_row.status);
  END IF;

  UPDATE public.friendships
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
      responded_at = now()
  WHERE id = p_friendship_id;

  RETURN jsonb_build_object('success', true,
    'status', CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
    'friendship_id', p_friendship_id);
END
$$;

CREATE OR REPLACE FUNCTION public.get_child_friends(p_child_id uuid)
RETURNS TABLE (
  friendship_id uuid,
  friend_child_id uuid,
  friend_name text,
  friend_kippy_tag text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_child_of_calling_device(p_child_id) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    f.id AS friendship_id,
    CASE WHEN f.requester_id = p_child_id THEN f.receiver_id ELSE f.requester_id END
      AS friend_child_id,
    c.name AS friend_name,
    c.kippy_tag AS friend_kippy_tag,
    CASE
      WHEN f.status = 'accepted' THEN 'accepted'
      WHEN f.status = 'declined' THEN 'declined'
      WHEN f.requester_id = p_child_id THEN 'pending_outgoing'
      ELSE 'pending_incoming'
    END AS status,
    f.created_at
  FROM public.friendships f
  JOIN public.children c
    ON c.id = CASE WHEN f.requester_id = p_child_id THEN f.receiver_id ELSE f.requester_id END
  WHERE f.requester_id = p_child_id OR f.receiver_id = p_child_id
  ORDER BY f.created_at DESC;
END
$$;

-- 6. GRANTS
GRANT EXECUTE ON FUNCTION public.get_my_kippy_tag(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(uuid, uuid, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_child_friends(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_child_of_calling_device(uuid) TO anon, authenticated;

-- 7. REALTIME PUBLICATION
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'friendships'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships';
  END IF;
END $$;

-- 8. SCHEMA RELOAD
NOTIFY pgrst, 'reload schema';