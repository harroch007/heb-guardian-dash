-- Add saved_at column to alerts table for saved alerts feature
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ DEFAULT NULL;