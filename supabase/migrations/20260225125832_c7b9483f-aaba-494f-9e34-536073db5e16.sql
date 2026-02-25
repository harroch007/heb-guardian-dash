
-- allowed_emails: drop restrictive, create permissive
DROP POLICY "Admins can insert allowed emails" ON allowed_emails;
DROP POLICY "Admins can view allowed emails" ON allowed_emails;
DROP POLICY "Admins can delete allowed emails" ON allowed_emails;

CREATE POLICY "Admins can insert allowed emails" ON allowed_emails FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can view allowed emails" ON allowed_emails FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete allowed emails" ON allowed_emails FOR DELETE TO authenticated USING (is_admin());

-- waitlist_signups: drop restrictive, create permissive
DROP POLICY "Admins can update waitlist" ON waitlist_signups;
DROP POLICY "Admins can view all waitlist" ON waitlist_signups;
DROP POLICY "Allow anonymous insert to waitlist" ON waitlist_signups;

CREATE POLICY "Admins can update waitlist" ON waitlist_signups FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can view all waitlist" ON waitlist_signups FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Allow anonymous insert to waitlist" ON waitlist_signups FOR INSERT TO anon, authenticated WITH CHECK (true);
