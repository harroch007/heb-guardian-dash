
-- Drop the existing restrictive admin policy
DROP POLICY "Admins can view queue" ON alert_events_queue;

-- Recreate as PERMISSIVE (default) so it overrides the restrictive false policy
CREATE POLICY "Admins can view queue"
  ON alert_events_queue FOR SELECT
  USING (is_admin());
