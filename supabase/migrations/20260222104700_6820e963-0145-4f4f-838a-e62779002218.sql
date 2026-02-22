
-- Drop all conflicting restrictive policies
DROP POLICY IF EXISTS "no_select_for_public_roles" ON public.alert_events_queue;
DROP POLICY IF EXISTS "no_modify_for_public_roles" ON public.alert_events_queue;
DROP POLICY IF EXISTS "no_update_for_public_roles" ON public.alert_events_queue;
DROP POLICY IF EXISTS "no_delete_for_public_roles" ON public.alert_events_queue;
DROP POLICY IF EXISTS "Admins can view queue" ON public.alert_events_queue;

-- Recreate admin SELECT as PERMISSIVE
CREATE POLICY "Admins can view queue"
  ON public.alert_events_queue
  FOR SELECT
  TO authenticated
  USING (is_admin());
