## הבעיה

הטריגר `on_app_alert_insert` (שרץ בעקבות `create_app_alert`) קורא ל-`net.http_post` עם URL שנבנה מ-`current_setting('app.settings.supabase_url', true)`. ה-GUC הזה לא מוגדר במסד → מחזיר `NULL` → `pg_net` נכשל עם `null value in column "url"` → כל הטרנזקציה של `report_pending_app` עושה Rollback, ולכן גם ה-Upsert ל-`installed_apps` ו-`blocked_app_attempts` לא נשמר.

## התיקון (מיגרציה אחת)

### 1. תיקון `on_app_alert_insert` — URL קשיח + הגנה

- להחליף את שורות ה-`current_setting(...)` ב-URL מלא קשיח של פרויקט Supabase:
  - `https://fsedenvbdpctzoznppwo.supabase.co/functions/v1/send-push-notification`
- להעביר את ה-Service Role Key מ-Vault: `vault.read_secret('service_role_key')` עם fallback ל-anon key אם לא קיים. אם Vault לא זמין/ריק — לנסות `current_setting('app.settings.service_role_key', true)`, ואם גם זה NULL — לדלג על שליחת הפוש (בלי לקרוס).
- לעטוף את כל לולאת ה-`net.http_post` ב-`BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE WARNING ...; END;` כך שכשל בפוש לא יפיל את ה-INSERT ל-`app_alerts`.

### 2. הגנת קריסות ב-`report_pending_app`

- לעטוף את הקריאה `PERFORM public.create_app_alert(...)` בבלוק `EXCEPTION WHEN OTHERS THEN` שרושם `RAISE WARNING` ולא מפיל את הפעולה. כך גם אם הטריגר ייכשל בעתיד מסיבה אחרת — `installed_apps` ו-`blocked_app_attempts` יישמרו.
- `push_sent` יוחזר כ-`false` במקרה כשל.

### 3. NOTIFY לסכמה

- בסוף המיגרציה: `NOTIFY pgrst, 'reload schema';`

## קוד טכני (תקציר)

```sql
-- on_app_alert_insert
v_supabase_url TEXT := 'https://fsedenvbdpctzoznppwo.supabase.co';
-- service role key: try vault → GUC → skip if both null
BEGIN
  FOR v_recipient_id IN ... LOOP
    BEGIN
      PERFORM net.http_post(url := v_supabase_url || '/functions/v1/send-push-notification', ...);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'push enqueue failed: %', SQLERRM;
    END;
  END LOOP;
END;

-- report_pending_app
BEGIN
  PERFORM public.create_app_alert(p_device_id, p_package_name, p_app_name);
  v_push_sent := true;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'create_app_alert failed: %', SQLERRM;
  v_push_sent := false;
END;
```

## הערה לגבי Service Role Key

ה-Service Role Key לא נחשף בקוד הצד-לקוח — הוא נשלף ב-runtime מתוך הסביבה של ה-DB. אם הוא לא מוגדר ב-Vault או כ-GUC, הקריאה ל-Edge Function תיכשל באימות. אצטרך לבדוק בעת הריצה אם `vault.secrets` מכיל את המפתח. אם לא — אעדכן אותך שצריך להוסיף אותו (אבל בכל מקרה הטרנזקציה כבר לא תקרוס בזכות ה-EXCEPTION).

## תוצאה

לאחר המיגרציה: קריאה מהאנדרואיד ל-`report_pending_app` תצליח תמיד לשמור את האפליקציה תחת "ממתינות לאישור", גם אם מנגנון הפוש נופל. הפוש עצמו יעבוד אם ה-Service Role Key זמין.
