
-- Migration 3: Create bonus_time_grants table
CREATE TABLE public.bonus_time_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  grant_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jerusalem')::date,
  bonus_minutes integer NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bonus_time_grants ENABLE ROW LEVEL SECURITY;

-- Parents can insert grants for their children
CREATE POLICY "Parents can insert bonus grants for their children"
ON public.bonus_time_grants
FOR INSERT
TO authenticated
WITH CHECK (
  child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid())
);

-- Parents can view their children's grants
CREATE POLICY "Parents can view their children bonus grants"
ON public.bonus_time_grants
FOR SELECT
TO authenticated
USING (
  child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid())
);

-- Admins can view all
CREATE POLICY "Admins can view all bonus grants"
ON public.bonus_time_grants
FOR SELECT
TO authenticated
USING (public.is_admin());
