
-- Migration 2: Add mode and manual times to schedule_windows
ALTER TABLE public.schedule_windows
ADD COLUMN mode text NOT NULL DEFAULT 'default',
ADD COLUMN manual_start_time time,
ADD COLUMN manual_end_time time;
