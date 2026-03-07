
-- 1. Create app_policies table (child-wide, not per-device)
CREATE TABLE public.app_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  package_name text NOT NULL,
  app_name text,
  is_blocked boolean NOT NULL DEFAULT false,
  blocked_at timestamptz,
  blocked_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, package_name)
);

-- RLS for app_policies
ALTER TABLE public.app_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view their children app policies"
  ON public.app_policies FOR SELECT
  TO authenticated
  USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

CREATE POLICY "Parents can insert app policies for their children"
  ON public.app_policies FOR INSERT
  TO authenticated
  WITH CHECK (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

CREATE POLICY "Parents can update their children app policies"
  ON public.app_policies FOR UPDATE
  TO authenticated
  USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

CREATE POLICY "Parents can delete their children app policies"
  ON public.app_policies FOR DELETE
  TO authenticated
  USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

CREATE POLICY "Admins can manage all app policies"
  ON public.app_policies FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 2. Create blocked_app_attempts table
CREATE TABLE public.blocked_app_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  package_name text NOT NULL,
  app_name text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_blocked_app_attempts_child_date 
  ON public.blocked_app_attempts (child_id, attempted_at DESC);

-- RLS for blocked_app_attempts
ALTER TABLE public.blocked_app_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view their children blocked attempts"
  ON public.blocked_app_attempts FOR SELECT
  TO authenticated
  USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

CREATE POLICY "Devices can insert blocked attempts"
  ON public.blocked_app_attempts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all blocked attempts"
  ON public.blocked_app_attempts FOR SELECT
  TO authenticated
  USING (is_admin());

-- 3. Add result column to device_commands for FAILED reason etc.
ALTER TABLE public.device_commands 
  ADD COLUMN IF NOT EXISTS result text;

-- 4. Auto-update updated_at on app_policies
CREATE TRIGGER set_app_policies_updated_at
  BEFORE UPDATE ON public.app_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
