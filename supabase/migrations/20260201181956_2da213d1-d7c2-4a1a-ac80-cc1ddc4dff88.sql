-- Create table for caching AI daily insights with cyclic day-of-week partitioning
CREATE TABLE public.child_daily_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  insight_date date NOT NULL,
  headline text NOT NULL,
  insights text[] NOT NULL,
  suggested_action text,
  severity_band text NOT NULL CHECK (severity_band IN ('calm', 'watch', 'intense')),
  data_quality text NOT NULL CHECK (data_quality IN ('good', 'partial', 'insufficient')),
  created_at timestamptz DEFAULT now(),
  
  -- Cyclic constraint: one row per child per day-of-week (max 7 rows per child)
  UNIQUE (child_id, day_of_week)
);

-- Enable Row Level Security
ALTER TABLE public.child_daily_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Parents can only view insights for their own children
CREATE POLICY "Parents can view their children insights"
  ON public.child_daily_insights
  FOR SELECT
  USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

-- RLS Policy: Service role can insert/update insights (edge function uses service role)
CREATE POLICY "Service role can manage insights"
  ON public.child_daily_insights
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_child_daily_insights_lookup 
  ON public.child_daily_insights (child_id, day_of_week, insight_date);