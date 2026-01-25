-- Enable RLS on allowed_emails table
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all allowed emails
CREATE POLICY "Admins can view allowed emails"
ON public.allowed_emails FOR SELECT
TO authenticated
USING (public.is_admin());

-- Allow admins to insert new allowed emails
CREATE POLICY "Admins can insert allowed emails"
ON public.allowed_emails FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Allow admins to delete allowed emails
CREATE POLICY "Admins can delete allowed emails"
ON public.allowed_emails FOR DELETE
TO authenticated
USING (public.is_admin());