

# תוכנית: תצוגת התראות ממתינות + תיקון שורשי לעיבוד

## הבעיה

1. **`pg_net` לא מופעל** -- ה-cron job (מס' 9) שרץ כל דקה מנסה לקרוא ל-`net.http_post()` כדי להפעיל את `analyze-alert`, אבל הפונקציה לא קיימת כי התוסף `pg_net` לא מופעל. זו הסיבה שכל 13+ ההתראות תקועות.
2. **אין תצוגה מפורטת** -- כרטיס בריאות התור מציג רק מספרים (כמה pending, כמה failed), אבל לא מציג את ההתראות עצמן.
3. **רשומות מיותמות** -- חלק מהרשומות בתור (850-853) כבר עובדו (is_processed=true באלרטים) אבל סטטוס התור עדיין "pending".

## מה ישתנה

### 1. הפעלת pg_net (פעולה ידנית נדרשת)
צריך להפעיל את התוסף `pg_net` בדשבורד Supabase:
- Database -> Extensions -> חפש "pg_net" -> Enable

אחרי ההפעלה, ה-cron job יתחיל לעבוד אוטומטית ויעבד התראה אחת כל דקה.

### 2. תצוגת רשימת התראות ממתינות בדשבורד

הוספת טבלה מפורטת מתחת לכרטיס בריאות התור שתציג:

| עמודה | תיאור |
|--------|--------|
| Alert ID | מזהה ההתראה |
| נוצר | תאריך ושעה |
| סטטוס תור | pending / failed / processing |
| ניסיונות | מספר הניסיונות |
| שגיאה אחרונה | אם נכשל |
| פעולות | כפתור "עבד עכשיו" להתראה בודדת |

הטבלה תוצג רק כשיש פריטים בתור (pending/failed).

### 3. ניקוי אוטומטי של רשומות מיותמות

הוספת לוגיקה ב-`fetchOverviewStats` שמזהה רשומות תור שההתראה המקושרת כבר עובדה (`is_processed = true`) ומציגה אותן בנפרד כ"מיותמות" עם אפשרות לנקות.

### 4. Fallback: עיבוד אוטומטי מהדשבורד

כשאדמין נכנס לדשבורד ויש התראות pending מעל 5 דקות, הצגת כפתור בולט "הפעל עיבוד אוטומטי" שירוץ בלולאה ויעבד את כל ההתראות הממתינות (כבר קיים חלקית, נשפר).

---

## פרטים טכניים

### שינויים בקובץ `src/pages/Admin.tsx`

1. הוספת שדה חדש ל-`OverviewStats`:
   - `pendingAlerts: { id: string; alert_id: number; status: string; attempt: number; created_at: string; last_error: string | null }[]`

2. עדכון `fetchOverviewStats` -- שליפת הרשימה המלאה של פריטי התור (pending + failed), לא רק ספירה:
   - `SELECT id, alert_id, status, attempt, created_at, last_error FROM alert_events_queue WHERE status IN ('pending', 'failed') ORDER BY created_at`

### שינויים בקובץ `src/pages/admin/AdminOverview.tsx`

1. הרחבת `QueueHealthCard` להציג טבלה מפורטת עם כל ההתראות הממתינות
2. הוספת כפתור "עבד עכשיו" ליד כל שורה שקורא ל-`analyze-alert` ומרענן את הנתונים
3. הוספת כפתור "נקה רשומות מיותמות" שקורא ל-Edge Function לניקוי

### Edge Function חדשה: `cleanup-stale-queue`

פונקציה קצרה שמנקה רשומות מהתור כאשר ההתראה כבר עובדה:
```
UPDATE alert_events_queue SET status = 'succeeded'
WHERE alert_id IN (SELECT id FROM alerts WHERE is_processed = true)
AND status = 'pending'
```

### אין שינויי סכמה במסד הנתונים
כל הנתונים כבר קיימים. ה-RLS policy לאדמין כבר נוצרה בשלב הקודם.

