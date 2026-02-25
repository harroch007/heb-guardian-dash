
-- Add is_locked column to parents
ALTER TABLE public.parents ADD COLUMN is_locked boolean NOT NULL DEFAULT false;

-- Allow admins to update parents table
CREATE POLICY "Admins can update parents"
ON public.parents
FOR UPDATE
USING (is_admin());
