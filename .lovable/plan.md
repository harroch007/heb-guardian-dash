

# ניתוח עומק: למה הדשבורד מציג 0 ולמה התראה 872 לא עובדה

## ממצאים

### באג 1: דשבורד ניהול מציג תמיד 0 (בריאות תור)

**שורש הבעיה**: למרות שתיקנו את מדיניות ה-RLS (מחקנו את הפוליסי החוסם), הטבלה `alert_events_queue` חסרה הרשאות בסיסיות (GRANT). בלוגים של PostgreSQL רואים שגיאה ברורה:

```
ERROR: permission denied for table alert_events_queue
```

הפוליסי RLS תוקן נכון - אבל RLS בודק **מה מותר לראות**. לפני זה, PostgreSQL בודק **אם מותר לגשת לטבלה בכלל** (GRANT). אין אף GRANT על הטבלה לאף role - אפילו לא `authenticated` או `anon`. לכן כל שאילתה מהדשבורד נכשלת עם "permission denied" ומחזירה 0.

**תיקון**: הוספת `GRANT SELECT ON public.alert_events_queue TO authenticated;`

---

### באג 2: התראות 871 ו-872 נכשלו בעיבוד

**השגיאה**: 
```
new row for relation "alerts" violates check constraint "alerts_processing_status_check"
```

**מצב נוכחי בבסיס הנתונים**:
- התראה 871: `processing_status = 'failed'`, `is_processed = false`, `ai_title = null`
- התראה 872: `processing_status = 'failed'`, `is_processed = false`, `ai_title = null`
- שתיהן בתור עם `status = 'failed'`, `attempt = 1`

**ניתוח**: הקוד הנוכחי ב-`analyze-alert` תמיד מגדיר `processing_status: 'analyzed'` - ערך שנמצא ב-CHECK constraint. לכן הסיבה הסבירה היא שגרסה ישנה של ה-Edge Function (שטרם נפרסה מחדש) השתמשה בערך לא חוקי. ה-Edge Function צריך פריסה מחדש כדי לוודא שהקוד העדכני רץ.

**תיקון**: 
1. פריסה מחדש של `analyze-alert`
2. איפוס ההתראות הנכשלות בתור כדי שיעובדו מחדש

---

## תוכנית תיקון

### שלב 1 - מיגרציה: הוספת GRANT על טבלת התור
```sql
GRANT SELECT ON public.alert_events_queue TO authenticated;
```
זה יאפשר לדשבורד הניהול לקרוא את נתוני התור (בכפוף לפוליסי RLS שכבר תוקן).

### שלב 2 - פריסה מחדש של Edge Function
פריסה מחדש של `analyze-alert` כדי לוודא שהקוד העדכני (שמגדיר ערכי `processing_status` חוקיים) הוא מה שרץ.

### שלב 3 - איפוס התראות שנכשלו
הפעלת `retry_failed_queue_items()` (הפונקציה שיצרנו קודם) כדי לאפס את התראות 871 ו-872 חזרה ל-`pending` ולתת להן ניסיון נוסף.

### פרטים טכניים

- אין שינויי קוד נדרשים - הקוד כבר נכון
- המיגרציה היא שורה אחת בלבד (GRANT)
- הפריסה מחדש של ה-Edge Function תתבצע אוטומטית
- איפוס ההתראות יתבצע דרך RPC שכבר קיים

