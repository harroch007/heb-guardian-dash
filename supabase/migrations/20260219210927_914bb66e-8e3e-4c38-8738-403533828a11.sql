-- Allow admins to read alert_events_queue
CREATE POLICY "Admins can view queue"
ON public.alert_events_queue
FOR SELECT
USING (public.is_admin());