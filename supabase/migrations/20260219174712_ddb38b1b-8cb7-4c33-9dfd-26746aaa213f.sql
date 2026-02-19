
-- Create alert_feedback table
CREATE TABLE public.alert_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id bigint NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  feedback_type text NOT NULL CHECK (feedback_type IN ('important', 'not_relevant')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_id, parent_id)
);

-- Enable RLS
ALTER TABLE public.alert_feedback ENABLE ROW LEVEL SECURITY;

-- Parents can insert their own feedback
CREATE POLICY "Parents can insert own feedback"
  ON public.alert_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (parent_id = auth.uid());

-- Parents can view their own feedback
CREATE POLICY "Parents can select own feedback"
  ON public.alert_feedback
  FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid());

-- Parents can update their own feedback (for upsert)
CREATE POLICY "Parents can update own feedback"
  ON public.alert_feedback
  FOR UPDATE
  TO authenticated
  USING (parent_id = auth.uid());

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
  ON public.alert_feedback
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
