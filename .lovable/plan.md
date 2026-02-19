

# תיקון Cron Job לעיבוד התור

## הבעיה
ה-cron job (מס' 9) קורא ל-`extensions.http_post()` אבל `pg_net` חושף את הפונקציה תחת הסכמה `net`, כלומר `net.http_post()`. לכן למרות ש-`pg_net` מופעל, העיבוד האוטומטי עדיין נכשל.

## הפתרון
עדכון ה-cron job כך שישתמש ב-`net.http_post()` במקום `extensions.http_post()`.

## פרטים טכניים

### מיגרציה: עדכון cron job

מחיקת ה-job הישן (מס' 9) ויצירת חדש עם הסינטקס הנכון:

```sql
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
```

### אין שינויים בקוד
רק תיקון SQL ב-cron job. אחרי התיקון, התור יתחיל להתרוקן אוטומטית (התראה אחת כל דקה).

