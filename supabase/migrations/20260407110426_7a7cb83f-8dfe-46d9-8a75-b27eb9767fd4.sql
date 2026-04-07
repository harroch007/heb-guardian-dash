
-- Phase 1: Add auth identity mapping column to devices
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for quick lookup by auth_user_id
CREATE INDEX IF NOT EXISTS idx_devices_auth_user_id ON public.devices(auth_user_id);
