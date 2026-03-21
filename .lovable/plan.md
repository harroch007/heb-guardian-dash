## פיצ'ר זמני שבת + חגים אוטומטיים — סטטוס ביצוע

### ✅ בוצע

| שלב | סטטוס | פרטים |
|---|---|---|
| טבלת `shabbat_times_computed` | ✅ | Migration — טבלה + UNIQUE + RLS service_role |
| טבלת `issur_melacha_windows` | ✅ | Migration — טבלה + indexes + UNIQUE + RLS service_role |
| Edge Function `calculate-shabbat-times` | ✅ | Phase 1: NOAA SPA (שבת), Phase 2: Hebcal API (חגים + שבתות 30 יום) |
| עדכון `get_device_settings` | ✅ | epoch values + `issur_melacha_windows` array (עד 10 חלונות קרובים) |
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

### מבנה Response של get_device_settings

```json
{
  "next_shabbat": {
    "friday_date": "2026-03-27",
    "candle_lighting": "18:24:00",
    "havdalah": "19:29:00",
    "shabbat_start_epoch_ms": 1774625909000,
    "shabbat_end_epoch_ms": 1774715350000
  },
  "issur_melacha_windows": [
    {
      "lock_type": "shabbat",
      "event_name": "Shabbat",
      "event_key": "shabbat-2026-03-27",
      "start_epoch_ms": 1774625909000,
      "end_epoch_ms": 1774715350000
    },
    {
      "lock_type": "yom_tov",
      "event_name": "Pesach I",
      "event_key": "yom_tov-2026-04-01",
      "start_epoch_ms": 1775057909000,
      "end_epoch_ms": 1775144350000
    }
  ]
}
```

### Edge Function לוגיקה

**Phase 1 (שבת):** NOAA SPA → `shabbat_times_computed` (שבת קרובה בלבד)
**Phase 2 (חגים):** Hebcal Jewish Calendar REST API → `issur_melacha_windows` (30 יום קדימה)

- Pairing: candles → havdalah הבא
- lock_type: `shabbat` (יום שישי) / `yom_tov` (חג)
- Merge: אם `next.start <= current.end + 10 דקות` → איחוד חלון
- UPSERT עם `onConflict: child_id,event_key,start_epoch_ms`

### Android צריך להשתמש ב:

1. `issur_melacha_windows` — מערך חלונות מוחלטים (epoch ms), כולל שבתות וחגים
2. `next_shabbat` — backward compatible, שבת הקרובה בלבד עם epoch
