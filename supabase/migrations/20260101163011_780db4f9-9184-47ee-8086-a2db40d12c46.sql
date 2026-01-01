-- Create waitlist_signups table
CREATE TABLE public.waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  child_age INTEGER NOT NULL CHECK (child_age >= 4 AND child_age <= 18),
  device_os TEXT NOT NULL CHECK (device_os IN ('android', 'iphone')),
  region TEXT,
  referral_source TEXT,
  referral_other TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending'
);

-- Create unique index on email (allow resubmission but track it)
CREATE UNIQUE INDEX waitlist_signups_email_idx ON public.waitlist_signups(email);

-- Enable RLS
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public waitlist form)
CREATE POLICY "Allow anonymous insert to waitlist"
ON public.waitlist_signups
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- No read/update/delete from client side
-- Only service role can read the data