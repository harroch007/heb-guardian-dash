-- Add is_conclusive column to track partial vs conclusive insights
ALTER TABLE public.child_daily_insights
ADD COLUMN is_conclusive boolean NOT NULL DEFAULT false;

-- Mark all existing insights as conclusive (they're for past dates)
UPDATE public.child_daily_insights
SET is_conclusive = true
WHERE insight_date < CURRENT_DATE;