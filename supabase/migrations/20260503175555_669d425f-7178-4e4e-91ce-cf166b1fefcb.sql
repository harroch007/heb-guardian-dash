
-- ============================================================
-- 1. kippy_tag generator
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_kippy_tag(p_base text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_suffix text;
  v_candidate text;
  v_attempts int := 0;
BEGIN
  -- Normalize base: lowercase, ascii-ish, replace non-alphanum with underscore
  v_base := lower(coalesce(p_base, 'user'));
  v_base := regexp_replace(v_base, '[^a-z0-9א-ת]+', '_', 'g');
  v_base := trim(both '_' from v_base);
  IF v_base = '' OR v_base IS NULL THEN
    v_base := 'user';
  END IF;
  v_base := substring(v_base from 1 for 16);

  LOOP
    v_attempts := v_attempts + 1;
    v_suffix := lpad(to_hex((random() * 65535)::int), 4, '0');
    v_candidate := '@' || v_base || '_' || v_suffix;

    IF NOT EXISTS (SELECT 1 FROM public.children WHERE kippy_tag = v_candidate)
       AND NOT EXISTS (SELECT 1 FROM public.parents  WHERE kippy_tag = v_candidate) THEN
      RETURN v_candidate;
    END IF;

    IF v_attempts > 50 THEN
      RAISE EXCEPTION 'Could not generate unique kippy_tag after 50 attempts';
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- 2. Add kippy_tag to parents + backfill + uniqueness
-- ============================================================
ALTER TABLE public.parents
  ADD COLUMN IF NOT EXISTS kippy_tag text;

UPDATE public.parents
SET kippy_tag = public.generate_kippy_tag(full_name)
WHERE kippy_tag IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS parents_kippy_tag_unique
  ON public.parents (kippy_tag)
  WHERE kippy_tag IS NOT NULL;

-- ============================================================
-- 3. Backfill children kippy_tag + uniqueness
-- ============================================================
UPDATE public.children
SET kippy_tag = public.generate_kippy_tag(name)
WHERE kippy_tag IS NULL OR kippy_tag = '';

CREATE UNIQUE INDEX IF NOT EXISTS children_kippy_tag_unique
  ON public.children (kippy_tag)
  WHERE kippy_tag IS NOT NULL;

-- ============================================================
-- 4. Triggers to auto-generate tag on insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_parent_kippy_tag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kippy_tag IS NULL OR NEW.kippy_tag = '' THEN
    NEW.kippy_tag := public.generate_kippy_tag(NEW.full_name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_parent_kippy_tag ON public.parents;
CREATE TRIGGER trg_ensure_parent_kippy_tag
  BEFORE INSERT ON public.parents
  FOR EACH ROW EXECUTE FUNCTION public.ensure_parent_kippy_tag();

CREATE OR REPLACE FUNCTION public.ensure_child_kippy_tag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kippy_tag IS NULL OR NEW.kippy_tag = '' THEN
    NEW.kippy_tag := public.generate_kippy_tag(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_child_kippy_tag ON public.children;
CREATE TRIGGER trg_ensure_child_kippy_tag
  BEFORE INSERT ON public.children
  FOR EACH ROW EXECUTE FUNCTION public.ensure_child_kippy_tag();

-- ============================================================
-- 5. chat_invites table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  inviter_id uuid NOT NULL,
  inviter_kippy_tag text,
  inviter_display_name text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by_id uuid,
  friendship_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_invites_inviter_idx ON public.chat_invites(inviter_id);
CREATE INDEX IF NOT EXISTS chat_invites_token_idx ON public.chat_invites(token);

ALTER TABLE public.chat_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inviter can view own invites" ON public.chat_invites;
CREATE POLICY "Inviter can view own invites"
  ON public.chat_invites FOR SELECT
  TO authenticated
  USING (inviter_id = auth.uid());

-- INSERT/UPDATE only via service role from edge functions; no direct policies.

NOTIFY pgrst, 'reload schema';
