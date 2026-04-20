

# תיקון חסימת אפליקציות: בעיית Instagram + בעיית "אפליקציות חדשות"

## שתי הבעיות קשורות אבל שונות

### בעיה 1 — Instagram (ואפליקציות חסומות ידנית)
ה-RPC `get_device_settings` מחזיר `daily_limit_minutes: null` במקום `-1`. האנדרואיד לא מזהה את האפליקציה כחסומה.

### בעיה 2 — אפליקציות "חדשות" (pending) לא נחסמות
כרגע יש **28 אפליקציות** ב-`installed_apps` בלי שורה מקבילה ב-`app_policies` (ביניהן TikTok, WhatsApp, Viber, Threads, Spotify, Facebook). ה-RPC לא מדווח עליהן כלל — הן פשוט לא מופיעות ב-`app_policies` שהמכשיר מקבל.

לפי חוזה האנדרואיד (Agent Contract): **"ללא פוליסי = חסימה כברירת מחדל"** — אבל זה תלוי בכך שהאנדרואיד יודע מה קיים ומה לא. אם המכשיר לא מקבל רשימה מלאה של אפליקציות עם סטטוס, אין לו מה להשוות.

### למה הן קשורות
שתיהן נובעות מאותו מקום: ה-RPC `get_device_settings` בונה את מערך `app_policies` **רק מטבלת `app_policies`**, ולא מצליב עם `installed_apps`. כלומר:
- אפליקציות חסומות ← מגיעות עם `daily_limit_minutes: null` (בעיה 1)
- אפליקציות ללא פוליסי ← לא מגיעות בכלל (בעיה 2)

## מה אממש

### שינוי 1 — תיקון `daily_limit_minutes` (בעיה 1)
בתוך ה-RPC, להחליף `null` ב-`-1` עבור אפליקציות חסומות:
```sql
'daily_limit_minutes', CASE WHEN ap.is_blocked THEN -1 ELSE null END
```

### שינוי 2 — הוספת אפליקציות pending ל-`app_policies` (בעיה 2)
הרחבת ה-query ב-RPC כך שיצליב את `installed_apps` עם `app_policies`, ויוסיף אפליקציות שאין להן פוליסי כ-`policy_status: 'pending_block'`:

```sql
-- קודם: רק app_policies
-- עכשיו: FULL JOIN עם installed_apps
SELECT COALESCE(jsonb_agg(...), '[]')
INTO v_app_policies
FROM (
  -- אפליקציות עם פוליסי קיים
  SELECT ap.package_name, 
         CASE WHEN ap.is_blocked THEN 'blocked' ELSE 'approved' END as policy_status,
         CASE WHEN ap.is_blocked THEN -1 ELSE null END as daily_limit_minutes,
         ap.always_allowed
  FROM app_policies ap WHERE ap.child_id = v_child_id
  
  UNION ALL
  
  -- אפליקציות מותקנות ללא פוליסי = pending → חסימה
  SELECT ia.package_name,
         'pending_block' as policy_status,
         -1 as daily_limit_minutes,
         false as always_allowed
  FROM installed_apps ia
  WHERE ia.child_id = v_child_id
    AND NOT EXISTS (SELECT 1 FROM app_policies ap2 
                    WHERE ap2.child_id = v_child_id 
                    AND ap2.package_name = ia.package_name)
) combined;
```

כך המכשיר יקבל:
```json
{
  "package_name": "com.zhiliaoapp.musically",
  "policy_status": "pending_block",
  "daily_limit_minutes": -1,
  "always_allowed": false
}
```

והאנדרואיד ידע לחסום את TikTok עד שההורה יאשר.

### שינוי 3 — עדכון `blocked_apps` array
גם מערך `blocked_apps` (שמשמש fallback ישן) צריך לכלול את ה-pending apps:

```sql
SELECT COALESCE(jsonb_agg(pkg), '[]')
INTO v_blocked_apps
FROM (
  SELECT ap.package_name as pkg FROM app_policies ap
  WHERE ap.child_id = v_child_id AND ap.is_blocked = true
  UNION
  SELECT ia.package_name FROM installed_apps ia
  WHERE ia.child_id = v_child_id
  AND NOT EXISTS (SELECT 1 FROM app_policies ap2 
                  WHERE ap2.child_id = v_child_id 
                  AND ap2.package_name = ia.package_name)
) all_blocked;
```

### שינוי 4 — טריגר DB על `app_policies`
טריגר אוטומטי שיוצר `REFRESH_SETTINGS` בכל שינוי ב-`app_policies`:

```sql
CREATE OR REPLACE FUNCTION notify_device_on_policy_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO device_commands (device_id, command_type, status)
  SELECT d.device_id, 'REFRESH_SETTINGS', 'PENDING'
  FROM devices d
  WHERE d.child_id = COALESCE(NEW.child_id, OLD.child_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### שינוי 5 — יישור הרשאות
`GRANT EXECUTE ON FUNCTION get_device_settings(text) TO anon, authenticated;` כדי לוודא עקביות.

## סיכום
- Migration אחד עם כל 5 השינויים
- אין שינוי בקוד React — הכול backend
- אין שינוי ב-UI של ניהול אפליקציות — רק מה שהמכשיר מקבל
- התוצאה: כל אפליקציה חדשה תיחסם אוטומטית עד אישור ההורה

