-- Create table to track AI insight generation logs
CREATE TABLE public.insight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  insight_date date NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('cached_conclusive', 'cached_recent', 'cached_late_night', 'generated_new', 'generated_upgrade')),
  is_today boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient querying by date range
CREATE INDEX idx_insight_logs_created_at ON public.insight_logs(created_at DESC);

-- RLS: Only service role can insert (from edge function), admins can view
ALTER TABLE public.insight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert insight logs"
  ON public.insight_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view insight logs"
  ON public.insight_logs FOR SELECT
  USING (public.is_admin());