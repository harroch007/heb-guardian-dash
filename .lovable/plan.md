## פיצ'ר זמני שבת אוטומטיים — סטטוס ביצוע

### ✅ בוצע

| שלב | סטטוס | פרטים |
|---|---|---|
| טבלת `shabbat_times_computed` | ✅ | Migration הורץ — טבלה + UNIQUE + RLS service_role |
| Edge Function `calculate-shabbat-times` | ✅ | NOAA sunset algorithm, upsert לכל ילד פעיל |
| עדכון `get_device_settings` | ✅ | epoch values מ-computed table, fallback לירושלים |
| `config.toml` | ✅ | `verify_jwt = false` |

### ⏳ ממתין לביצוע ידני

**Cron Job** — צריך להריץ ב-SQL Editor של Supabase:

```sql
SELECT cron.schedule(
  'calculate-shabbat-times-weekly',
  '0 2 * * 4',
  $$
  SELECT net.http_post(
    url:='https://fsedenvbdpctzoznppwo.supabase.co/functions/v1/calculate-shabbat-times',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZWRlbnZiZHBjdHpvem5wcHdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNjkxMzcsImV4cCI6MjA4MTg0NTEzN30.Lvu-qGDtzhL3-7QHdzimsRWQ2I6Wy7jJasidbfEFrVU"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

### תוצאות בדיקה

- Edge Function מחשבת ל-7 ילדים פעילים
- `get_device_settings` מחזיר epoch values:
  - עם computed: `shabbat_start_epoch_ms` = 18:38 Israel (location-based)
  - עם fallback: `shabbat_start_epoch_ms` = 18:24 Israel (Jerusalem static)
- Havdalah מדויק: 19:29 Israel (תואם לנתונים הסטטיים)

### פלט get_device_settings

```json
{
  "next_shabbat": {
    "friday_date": "2026-03-27",
    "candle_lighting": "18:24:00",
    "havdalah": "19:29:00",
    "shabbat_start_epoch_ms": 1774625909000,
    "shabbat_end_epoch_ms": 1774715350000
  }
}
```

**Android צריך להשתמש ב-`shabbat_start_epoch_ms` ו-`shabbat_end_epoch_ms` בלבד** — הם מוחלטים ולא דורשים המרת timezone.
