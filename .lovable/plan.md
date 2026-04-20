

# תיקון קריסת `get_device_settings` — טבלה `computed_shabbat_times` לא קיימת

## הבעיה
ב-RPC (שורות 155-175) יש שתי קריאות לטבלה בשם `computed_shabbat_times` — **טבלה זו לא קיימת**. הטבלאות בפועל הן:
- `shabbat_times_computed` (עם עמודות `friday_date`, `start_epoch_ms`, `end_epoch_ms`)
- `issur_melacha_windows` (עם `event_name`, `start_epoch_ms`, `end_epoch_ms`, `valid_for_date`)

מקור השגיאה: `42P01: relation "computed_shabbat_times" does not exist`. כל קריאה ל-`get_device_settings` קורסת ולכן השינוי בדשבורד (חסימה/פתיחה) לא מגיע למכשיר.

## התיקון (מיגרציה אחת)

### החלפת בלוק `next_issur` + `issur_windows`
במקום `computed_shabbat_times` להשתמש בטבלה הנכונה `issur_melacha_windows` שכבר מאוכלסת על ידי edge function `calculate-shabbat-times`:

```sql
-- next_issur: החלון הפעיל הקרוב
SELECT * INTO v_computed_shabbat
FROM issur_melacha_windows
WHERE child_id = v_child_id
  AND is_active = true
  AND end_epoch_ms >= (EXTRACT(EPOCH FROM now()) * 1000)::bigint
ORDER BY start_epoch_ms LIMIT 1;

IF FOUND THEN
  v_settings := v_settings || jsonb_build_object('next_issur', jsonb_build_object(
    'label', v_computed_shabbat.event_name,
    'lock_type', v_computed_shabbat.lock_type,
    'start_epoch', (v_computed_shabbat.start_epoch_ms / 1000)::bigint,
    'end_epoch',   (v_computed_shabbat.end_epoch_ms   / 1000)::bigint,
    'start_epoch_ms', v_computed_shabbat.start_epoch_ms,
    'end_epoch_ms',   v_computed_shabbat.end_epoch_ms
  ));
END IF;

-- issur_windows: 10 הקרובים
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'label', w.event_name,
  'lock_type', w.lock_type,
  'start_epoch',    (w.start_epoch_ms / 1000)::bigint,
  'end_epoch',      (w.end_epoch_ms   / 1000)::bigint,
  'start_epoch_ms', w.start_epoch_ms,
  'end_epoch_ms',   w.end_epoch_ms
)), '[]'::jsonb) INTO v_issur_windows
FROM (
  SELECT * FROM issur_melacha_windows
  WHERE child_id = v_child_id AND is_active = true
    AND end_epoch_ms >= (EXTRACT(EPOCH FROM now()) * 1000)::bigint
  ORDER BY start_epoch_ms LIMIT 10
) w;
v_settings := v_settings || jsonb_build_object('issur_windows', v_issur_windows);
```

### שמירת הרשאות + רענון cache
```sql
GRANT EXECUTE ON FUNCTION public.get_device_settings(text) TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
```

### אימות בתוך המיגרציה
בסוף הקובץ אריץ `SELECT public.get_device_settings('9d5a9132b033a86b')` ואוודא שמתקבל JSON תקין שכולל `app_policies` עם Instagram. אם נכשל — המיגרציה תיפול.

## תוצאה צפויה
- ה-RPC חוזר לעבוד ללא שגיאת 42P01
- המכשיר יקבל סוף-סוף את `app_policies` המעודכן ויחסום את Instagram תוך שניות מהלחיצה בדשבורד
- שדות `next_issur` / `issur_windows` עובדים עכשיו על מקור הנתונים האמיתי (Hebcal + NOAA)

## מה לא משתנה
- אין שינוי בקוד React, ב-UI, או באנדרואיד
- אין שינוי בלוגיקה האחרת של ה-RPC
- רק 2 בלוקי SELECT מתוקנים לטבלה הנכונה

