

# תיקון קריסת complete_chore — NULL URL בטריגר Push

## הבעיה
הטריגר `trg_chore_completed_push` על טבלת `chores` קורא ל-`net.http_post()` עם URL שמורכב מ-`current_setting('app.settings.supabase_url', true)`. ההגדרה הזו לא קיימת בדאטהבייס, מחזירה NULL, וגורמת ל-NOT NULL constraint violation ב-`http_request_queue`. כל הטרנזקציה עושה rollback והמשימה נשארת `pending`.

**אותה בעיה קיימת גם ב-`on_chore_created_push`.**

## הפתרון — מיגרציה אחת

### שלב 1: הוספת NULL guard לשני הטריגרים
נוסיף בדיקה בתחילת כל טריגר — אם `v_supabase_url` הוא NULL, נדלג על שליחת ה-Push ונחזיר `NEW` בלי לקרוס. ככה גם אם ההגדרות לא מוגדרות, המשימה תעודכן בהצלחה.

### שלב 2: הגדרת app.settings
נגדיר את `app.settings.supabase_url` ו-`app.settings.service_role_key` ברמת הדאטהבייס כדי שה-Push Notifications יעבדו.

## קבצים שמשתנים
- **מיגרציה חדשה בלבד** — אפס שינויים בקוד הפרונט-אנד או באנדרואיד.

## תוצאה צפויה
- `complete_chore` מהאנדרואיד יצליח ← המשימה תעבור ל-`completed_by_child`
- ההורה יראה את העדכון בזמן אמת דרך ה-Realtime subscription
- Push notification יישלח להורה (אם ההגדרות מוגדרות)

