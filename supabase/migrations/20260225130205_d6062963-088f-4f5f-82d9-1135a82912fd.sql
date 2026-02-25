CREATE POLICY "Admins can delete waitlist entries"
ON waitlist_signups FOR DELETE TO authenticated
USING (is_admin());