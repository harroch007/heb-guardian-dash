
DROP POLICY IF EXISTS "Parents can insert own feedback" ON alert_feedback;
DROP POLICY IF EXISTS "Parents can select own feedback" ON alert_feedback;
DROP POLICY IF EXISTS "Parents can update own feedback" ON alert_feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON alert_feedback;

CREATE POLICY "Parents can insert own feedback" ON alert_feedback
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Parents can select own feedback" ON alert_feedback
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (parent_id = auth.uid());

CREATE POLICY "Parents can update own feedback" ON alert_feedback
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (parent_id = auth.uid());

CREATE POLICY "Admins can view all feedback" ON alert_feedback
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin());
