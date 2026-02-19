SELECT cron.unschedule(9);

SELECT cron.schedule(
  'process-alert-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fsedenvbdpctzoznppwo.supabase.co/functions/v1/analyze-alert',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZWRlbnZiZHBjdHpvem5wcHdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNjkxMzcsImV4cCI6MjA4MTg0NTEzN30.Lvu-qGDtzhL3-7QHdzimsRWQ2I6Wy7jJasidbfEFrVU"}'::jsonb,
    body := '{"mode": "queue"}'::jsonb
  ) AS request_id;
  $$
);