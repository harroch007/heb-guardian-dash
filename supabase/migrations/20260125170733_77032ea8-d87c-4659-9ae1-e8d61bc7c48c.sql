-- Admin RLS policies for comprehensive dashboard access

-- Parents table: Allow admins to view all parents
CREATE POLICY "Admins can view all parents"
ON public.parents FOR SELECT
TO authenticated
USING (public.is_admin());

-- Children table: Allow admins to view all children
CREATE POLICY "Admins can view all children"
ON public.children FOR SELECT
TO authenticated
USING (public.is_admin());

-- Devices table: Allow admins to view all devices
CREATE POLICY "Admins can view all devices"
ON public.devices FOR SELECT
TO authenticated
USING (public.is_admin());

-- Alerts table: Allow admins to view all alerts
CREATE POLICY "Admins can view all alerts"
ON public.alerts FOR SELECT
TO authenticated
USING (public.is_admin());

-- Waitlist signups: Allow admins to view all waitlist entries
CREATE POLICY "Admins can view all waitlist"
ON public.waitlist_signups FOR SELECT
TO authenticated
USING (public.is_admin());

-- Waitlist signups: Allow admins to update waitlist entries (for approval)
CREATE POLICY "Admins can update waitlist"
ON public.waitlist_signups FOR UPDATE
TO authenticated
USING (public.is_admin());

-- Device daily metrics: Allow admins to view all metrics
CREATE POLICY "Admins can view all device metrics"
ON public.device_daily_metrics FOR SELECT
TO authenticated
USING (public.is_admin());

-- App usage: Allow admins to view all app usage
CREATE POLICY "Admins can view all app usage"
ON public.app_usage FOR SELECT
TO authenticated
USING (public.is_admin());