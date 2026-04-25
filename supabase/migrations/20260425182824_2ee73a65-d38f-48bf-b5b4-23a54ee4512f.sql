-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any pre-existing job with the same name (idempotent)
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'calculate-shabbat-times-daily';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

-- Schedule daily run at 03:00 UTC (06:00 Asia/Jerusalem)
SELECT cron.schedule(
  'calculate-shabbat-times-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fsedenvbdpctzoznppwo.supabase.co/functions/v1/calculate-shabbat-times',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZWRlbnZiZHBjdHpvem5wcHdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNjkxMzcsImV4cCI6MjA4MTg0NTEzN30.Lvu-qGDtzhL3-7QHdzimsRWQ2I6Wy7jJasidbfEFrVU"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);