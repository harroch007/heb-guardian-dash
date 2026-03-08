
-- Migration 1: Add policy_status to app_policies
ALTER TABLE public.app_policies
ADD COLUMN policy_status text NOT NULL DEFAULT 'approved';

-- Backfill existing rows
UPDATE public.app_policies SET policy_status = 'blocked' WHERE is_blocked = true;
UPDATE public.app_policies SET policy_status = 'approved' WHERE is_blocked = false;
