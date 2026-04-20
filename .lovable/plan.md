

# תיקון סופי של חסימת אפליקציות — בעיית הרשאות RPC

## הבעיה האמיתית
ה-pipeline עובד מקצה לקצה **חוץ מצעד אחד**:
1. ההורה חוסם → `app_policies.is_blocked=true` ✅
2. טריגר DB יוצר `REFRESH_SETTINGS` ב-`device_commands` ✅
3. האנדרואיד מאשר את ה-command (`ACKNOWLEDGED`) ✅
4. האנדרואיד קורא `get_device_settings(device_id)` ❌ → **`permission denied`**
5. בלי תשובה תקינה → אין נתונים חדשים → Instagram נשאר פתוח

הוכחה חיה: אני בעצמי קיבלתי `ERROR: 42501: permission denied for function get_device_settings` כשניסיתי להריץ אותה.

המיגרציה הקודמת אמנם כללה `GRANT EXECUTE`, אבל פונקציה שמוגדרת מחדש (`CREATE OR REPLACE`) מאבדת לפעמים הרשאות, או שה-`REVOKE FROM PUBLIC` ברירת המחדל של Postgres חסם אותה.

## מה אממש (מיגרציה אחת קצרה)

### 1. יישור הרשאות בצורה אגרסיבית
```sql
REVOKE ALL ON FUNCTION public.get_device_settings(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_device_settings(text) TO anon, authenticated, service_role;
```

### 2. וידוא ש-`SECURITY DEFINER` עובד נכון
לוודא שה-`OWNER` של הפונקציה הוא `postgres` (לא `supabase_admin` או role עם הרשאות חסרות), כדי ש-`SECURITY DEFINER` יוכל לעקוף את ה-RLS של הטבלאות הפנימיות.

### 3. רענון cache של PostgREST
```sql
NOTIFY pgrst, 'reload schema';
```
כדי שההרשאות החדשות ייתפסו ב-PostgREST מיד.

### 4. בדיקה מיידית בתוך ה-migration
בסוף המיגרציה אריץ `SELECT public.get_device_settings('9d5a9132b033a86b')` כ-`anon` כדי לוודא שזה עובד. אם לא — המיגרציה תיפול במקום לדווח על הצלחה כוזבת.

## תשובות מדויקות לסוכן האנדרואיד

לפי הבדיקה החיה שלי כרגע ב-DB (לפני התיקון):

**שאלה 1 — האם `REFRESH_SETTINGS` נוצר?**
כן. עבור `device_id=9d5a9132b033a86b` נוצרו 10 פקודות `REFRESH_SETTINGS` בשעות האחרונות, כולן `ACKNOWLEDGED`. הטריגר `trg_notify_device_on_policy_change` על `app_policies` פעיל ועובד.

**שאלה 2 — מה `get_device_settings` מחזירה?**
**הרצה ידנית מחזירה `permission denied`.** זה ה-root cause. אחרי התיקון התשובה אמורה להכיל:
```json
{
  "package_name": "com.instagram.android",
  "policy_status": "blocked",
  "daily_limit_minutes": -1,
  "always_allowed": false
}
```

**שאלה 3 — האם `blocked_apps` כולל את האפליקציה?**
לפי קוד ה-RPC כן (`com.instagram.android` נכלל דרך ה-`UNION` שכותב `blocked_apps`). זה ייאומת אחרי שההרשאות יתוקנו.

## מה הסוכן אנדרואיד צריך לבדוק מצידו אחרי התיקון
1. שהקריאה ל-`rpc('get_device_settings', { p_device_id })` חוזרת **בלי error 42501** ועם payload תקין
2. שהוא קורא לה גם ב-`anon` mode (לפני קבלת JWT של device) — לא רק ב-authenticated

## לאחר אישור
- מיגרציה אחת — פתרון הרשאות בלבד
- אין שינוי בקוד React, אין שינוי בלוגיקת ה-RPC, אין שינוי בטריגר
- אחרי אפליי: לחיצה על Switch בדשבורד → תוך שניות Instagram ייחסם בפועל בטלפון

