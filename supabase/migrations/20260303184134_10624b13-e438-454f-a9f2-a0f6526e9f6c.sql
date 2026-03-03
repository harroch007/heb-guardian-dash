
-- 1. Table for raw heartbeats
CREATE TABLE IF NOT EXISTS public.device_heartbeats_raw (
  id bigserial PRIMARY KEY,
  child_id uuid,
  device_id text NOT NULL,
  device jsonb NOT NULL,
  permissions jsonb NOT NULL,
  reported_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.device_heartbeats_raw ENABLE ROW LEVEL SECURITY;

-- 3. RLS: allow INSERT for all (function is SECURITY DEFINER)
CREATE POLICY "Allow insert for all"
  ON public.device_heartbeats_raw
  FOR INSERT
  WITH CHECK (true);

-- 4. RLS: admin SELECT
CREATE POLICY "Admins can view heartbeats"
  ON public.device_heartbeats_raw
  FOR SELECT
  USING (public.is_admin());

-- 5. RPC function matching Android signature exactly
CREATE OR REPLACE FUNCTION public.report_device_heartbeat(
  p_child_id uuid,
  p_device jsonb,
  p_device_id text,
  p_permissions jsonb,
  p_timestamp timestamptz
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  INSERT INTO public.device_heartbeats_raw (child_id, device_id, device, permissions, reported_at)
  VALUES (p_child_id, p_device_id, p_device, p_permissions, coalesce(p_timestamp, now()));
$$;

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
