-- Create table for allowed emails (whitelist)
CREATE TABLE public.allowed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  added_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Enable RLS (only service role should access this directly)
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- Create function to check if email is allowed (public access for auth flow)
CREATE OR REPLACE FUNCTION public.is_email_allowed(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM allowed_emails WHERE LOWER(email) = LOWER(p_email)
  );
$$;