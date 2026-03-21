## תכנית ביצוע — הרחבת זמני שבת לחגים (issur_melacha_windows)

### ממצאים מהמיפוי

**מצב קיים:**

- Edge Function `calculate-shabbat-times` מחשבת שבת בלבד עם NOAA SPA, כותבת ל-`shabbat_times_computed`
- `get_device_settings` מחזיר `next_shabbat` עם epoch values, fallback לירושלים
- `devices` table: `device_id` הוא `text` (לא uuid), אין עמודת `id` uuid — צריך להתאים את ה-schema

**התאמה נדרשת לspec:** הטבלה `devices` משתמשת ב-`device_id text` כ-PK, לא `id uuid`. לכן `device_id` בטבלה החדשה לא יכול להיות uuid FK ל-`devices(id)`. אני אשמיט את עמודת `device_id` מהטבלה החדשה — `child_id` מספיק לזיהוי, והמיקום נלקח מ-`devices` דרך `child_id`. זה מונע FK שבור ומפשט.

---

### שלב 1: Migration

טבלה `issur_melacha_windows` עם כל השדות מהspec חוץ מ-`device_id` (הוסבר למעלה).

אינדקסים + `UNIQUE` constraint + RLS `service_role` בלבד.

להוסיף גם:

- `timezone text not null default 'Asia/Jerusalem'`
- `source text not null default 'hebcal_jewish_calendar'`
- `computed_at timestamptz not null default now()`
- `is_active boolean not null default true`

---

### שלב 2: הרחבת Edge Function

הרחבת `calculate-shabbat-times/index.ts`:

1. **שלב שבת קיים** — נשמר כמו שהוא (`NOAA SPA` → `shabbat_times_computed`)
2. **שלב חגים חדש:**
  - לכל ילד פעיל, קריאה ל-`Hebcal Jewish Calendar REST API` עם הפרמטרים שצוינו (30 יום קדימה)
  - שימוש ב:
    - `v=1`
    - `cfg=json`
    - `start`
    - `end`
    - `maj=on`
    - `yto=on`
    - `i=on`
    - `c=on`
    - `M=on`
    - `latitude`
    - `longitude`
    - `tzid=Asia/Jerusalem`
  - פירוק ה-response: זיהוי `candles` ו-`havdalah` events
  - `Pairing`: כל `candles` → `havdalah` הבא
  - קביעת `lock_type`: `shabbat` vs `yom_tov` לפי event type / category, לא רק לפי title
  - **Merge logic:** אם `next.start <= current.end + 10min` → איחוד
  - `UPSERT` ל-`issur_melacha_windows`
  - לוגים מפורטים: `child_id`, `lat/lon`, `Hebcal URL`, `items count`, `pre/post merge counts`
3. **Backward compatibility:**
  - להמשיך לעדכן גם את `shabbat_times_computed` עבור השבת הקרובה בלבד
  - לא לשבור את ה-flow הקיים שכבר עובד

---

### שלב 3: עדכון get_device_settings

הוספת בלוק חדש אחרי `next_shabbat`:

- `SELECT` מ-`issur_melacha_windows` לפי `child_id`
- רק `is_active = true`
- רק `end_epoch_ms > now()`
- `LIMIT 10`, `ORDER BY start_epoch_ms`
- מחזיר כ-`issur_melacha_windows` array ב-`JSON response`

`next_shabbat` נשאר כמו שהוא היום, כולל:

- `friday_date`
- `candle_lighting`
- `havdalah`
- `shabbat_start_epoch_ms`
- `shabbat_end_epoch_ms`

אם אין חלונות — להחזיר `issur_melacha_windows: []`

---

### שלב 4: Cron

לא נדרש שינוי — ה-cron הקיים מפעיל את אותה Edge Function.

הפונקציה המורחבת תמשיך לחשב:

- את השבת הקרובה ל-`shabbat_times_computed`
- וגם את חלונות `issur_melacha_windows` ל-30 יום קדימה

---

### קבצים שישתנו


| קובץ                                                  | שינוי                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| Migration חדשה                                        | טבלה `issur_melacha_windows` + RLS + indexes                               |
| Migration חדשה                                        | `get_device_settings` עם `issur_melacha_windows` array                     |
| `supabase/functions/calculate-shabbat-times/index.ts` | הרחבה עם `Hebcal API` + merge + upsert + שמירה על `shabbat_times_computed` |
