
-- Create table for weekly/monthly periodic summaries
CREATE TABLE public.child_periodic_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  headline TEXT NOT NULL,
  insights TEXT[] NOT NULL DEFAULT '{}',
  suggested_action TEXT,
  severity_summary TEXT CHECK (severity_summary IN ('calm', 'mixed', 'intense')),
  data_quality TEXT,
  positive_highlights TEXT[] DEFAULT '{}',
  stats_snapshot JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(child_id, period_type, period_start)
);

-- Enable RLS
ALTER TABLE public.child_periodic_summaries ENABLE ROW LEVEL SECURITY;

-- Parents can view their children's summaries
CREATE POLICY "Parents can view their children summaries"
  ON public.child_periodic_summaries
  FOR SELECT
  USING (child_id IN (
    SELECT id FROM public.children WHERE parent_id = auth.uid()
  ));

-- Service role can manage summaries (insert/update/delete)
CREATE POLICY "Service role can manage summaries"
  ON public.child_periodic_summaries
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_periodic_summaries_child_type ON public.child_periodic_summaries(child_id, period_type, period_start DESC);
