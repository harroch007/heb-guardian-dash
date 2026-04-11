

# תיקון קריסת request_extra_time — NULL URL בטריגרי Push

## הבעיה (זהה לבאג של המשימות)
שני טריגרים על טבלת `time_extension_requests` קוראים ל-`net.http_post()` עם URL שמגיע מ-`current_setting('app.settings.supabase_url', true)` — שמחזיר NULL. זה גורם ל-NOT NULL constraint violation ב-`http_request_queue`, כל הטרנזקציה עושה rollback, והבקשה לא נשמרת.

**הטריגרים הבעייתיים:**
1. `on_time_request_insert` — נורה כשנוצרת בקשה חדשה (INSERT)
2. `on_time_request_responded_push` — נורה כשהורה מגיב לבקשה (UPDATE)

## הפתרון — מיגרציה אחת (זהה לדפוס שכבר עבד)

### שינויים בשני הטריגרים:
- **Fallback URL:** `COALESCE(current_setting(...), 'https://fsedenvbdpctzoznppwo.supabase.co')`
- **NULL guard:** אם `v_service_role_key IS NULL` → `RETURN NEW` בלי לקרוס

## קבצים שמשתנים
- מיגרציה חדשה בלבד — אפס שינויים בקוד הפרונט-אנד או באנדרואיד.

## תוצאה צפויה
- הילד ילחץ "בקשת זמן נוסף" ← הבקשה תישמר בהצלחה
- ההורה יראה את הבקשה בזמן אמת ויוכל לאשר/לדחות
- Push notifications יישלחו (אם ההגדרות מוגדרות)

