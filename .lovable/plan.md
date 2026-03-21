

## תכנית ביצוע — זמני שבת אוטומטיים לפי מיקום

### Overview

4 שלבים: טבלת cache → Edge Function → Cron → עדכון get_device_settings

---

### שלב 1: Migration — טבלת `shabbat_times_computed`

```sql
CREATE TABLE public.shabbat_times_computed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  friday_date date NOT NULL,
  start_epoch_ms bigint NOT NULL,
  end_epoch_ms bigint NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, friday_date)
);

ALTER TABLE public.shabbat_times_computed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.shabbat_times_computed
  FOR ALL TO service_role USING (true);
```

RLS: רק service_role כותב (Edge Function). ה-RPC `get_device_settings` רץ כ-SECURITY DEFINER ולכן יכול לקרוא ישירות.

---

### שלב 2: Edge Function `calculate-shabbat-times`

**קובץ:** `supabase/functions/calculate-shabbat-times/index.ts`

**לוגיקה:**
- מושך את כל הילדים הפעילים (שיש להם device עם lat/lon ו-last_seen בשבוע האחרון)
- מחשב את יום שישי הקרוב
- לכל ילד, מחשב sunset לפי lat/lon באמצעות **Solar Position Algorithm** (SPA) — חישוב אסטרונומי ישיר בלי תלות בספריות חיצוניות
  - כניסת שבת = sunset ביום שישי minus 18 דקות (מנהג ירושלים) / 40 דקות (אפשרות — נלך על 18 כברירת מחדל)
  - יציאת שבת = sunset ביום שבת plus 32 דקות (3 כוכבים קטנים ~8.5 מעלות)
- ממיר ל-epoch_ms
- UPSERT ל-`shabbat_times_computed`

**למה SPA ולא hebcal:**
- hebcal היא ספרייה JS גדולה שעלולה לגרום לבעיות deploy ב-Deno Edge Functions
- חישוב sunset לפי lat/lon/date הוא פורמולה מתמטית ידועה (~50 שורות)
- יציב יותר, אין תלות חיצונית

**Offset defaults:**
- `candle_lighting_offset`: -18 דקות מ-sunset (ניתן להתאים בעתיד)
- `havdalah_offset`: +32 דקות מ-sunset

---

### שלב 3: Cron Job

באמצעות `pg_cron` + `pg_net` — רץ כל יום חמישי בשעה 02:00 (UTC) = 05:00 בישראל.

SQL INSERT (לא migration — מכיל project-specific URL + anon key):
```sql
SELECT cron.schedule(
  'calculate-shabbat-times-weekly',
  '0 2 * * 4',  -- כל יום חמישי 02:00 UTC
  $$
  SELECT net.http_post(
    url:='https://fsedenvbdpctzoznppwo.supabase.co/functions/v1/calculate-shabbat-times',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

---

### שלב 4: עדכון `get_device_settings`

**שינוי ב-migration (CREATE OR REPLACE FUNCTION):**

בבלוק הקיים של `next_shabbat`, אחרי שמושכים `v_shabbat_row`:

1. נסה SELECT מ-`shabbat_times_computed` לפי `v_child_id` ו-`friday_date` >= CURRENT_DATE
2. אם נמצא → השתמש ב-`start_epoch_ms` ו-`end_epoch_ms` מהטבלה
3. אם לא נמצא (fallback) → חשב epoch מ-`shabbat_zmanim` הסטטי:
   - `start_epoch_ms = EXTRACT(EPOCH FROM (friday_date + candle_lighting)) * 1000` (ב-Asia/Jerusalem)
   - `end_epoch_ms = EXTRACT(EPOCH FROM ((friday_date + 1) + havdalah)) * 1000` (ב-Asia/Jerusalem)

**תוצאה:**
```json
{
  "next_shabbat": {
    "friday_date": "2026-03-27",
    "candle_lighting": "18:24:00",
    "havdalah": "19:29:00",
    "shabbat_start_epoch_ms": 1743094440000,
    "shabbat_end_epoch_ms": 1743189540000
  }
}
```

Backward compatible — `candle_lighting` ו-`havdalah` נשארים.

---

### קבצים שישתנו

| קובץ | שינוי |
|---|---|
| Migration חדשה | `shabbat_times_computed` table + updated `get_device_settings` with epoch + fallback |
| `supabase/functions/calculate-shabbat-times/index.ts` | Edge Function חדשה |
| `supabase/config.toml` | `verify_jwt = false` ל-function החדשה |
| Cron job (INSERT via SQL editor) | `pg_cron` schedule |

### אין שינוי ב:
- UI / Lovable components
- `shabbat_zmanim` (נשאר כ-fallback)
- Android code

### Technical Details

**Solar position calculation:**
- Uses simplified NOAA solar calculator algorithm
- Input: latitude, longitude, date (UTC)
- Output: sunset time as Date object
- Accuracy: ~1 minute (sufficient for halachic zmanim with fixed offsets)

**Fallback epoch calculation in SQL:**
```sql
EXTRACT(EPOCH FROM (v_shabbat_row.friday_date + v_shabbat_row.candle_lighting) 
  AT TIME ZONE 'Asia/Jerusalem') * 1000
```

**בדיקות:**
```sql
-- Verify computed times exist
SELECT * FROM shabbat_times_computed ORDER BY friday_date DESC LIMIT 5;

-- Verify get_device_settings returns epochs
SELECT get_device_settings('DEVICE_ID_HERE')->'next_shabbat';
```

