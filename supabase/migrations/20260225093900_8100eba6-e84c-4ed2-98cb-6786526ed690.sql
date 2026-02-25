
-- 1. Admin notes table
CREATE TABLE public.admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL,
  note_text text NOT NULL,
  note_type text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all notes"
  ON public.admin_notes FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert notes"
  ON public.admin_notes FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete notes"
  ON public.admin_notes FOR DELETE
  USING (public.is_admin());

-- 2. Admin activity log table (append-only)
CREATE TABLE public.admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  target_parent_id uuid NOT NULL,
  action_type text NOT NULL,
  action_details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view activity log"
  ON public.admin_activity_log FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert activity log"
  ON public.admin_activity_log FOR INSERT
  WITH CHECK (public.is_admin());

-- Index for fast lookups by parent
CREATE INDEX idx_admin_notes_parent_id ON public.admin_notes(parent_id);
CREATE INDEX idx_admin_activity_log_target ON public.admin_activity_log(target_parent_id);

-- Admin UPDATE policy on children for granting benefits
CREATE POLICY "Admins can update children"
  ON public.children FOR UPDATE
  USING (public.is_admin());
