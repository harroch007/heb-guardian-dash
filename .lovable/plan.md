

# תיקון תצוגת תור ההתראות בדשבורד ניהול

## הבעיה

שתי בעיות מונעות את הצגת נתוני התור בדשבורד:

### 1. בעיית הרשאות (RLS) - קריטי
הטבלה `alert_events_queue` מכילה מדיניות RLS מסוג **restrictive** שחוסמת גם מנהלים:
- `no_select_for_public_roles` (restrictive) = `USING (false)` 
- `Admins can view queue` (restrictive) = `USING (is_admin())`

כשכל המדיניות הן restrictive, הן מתחברות ב-AND: `false AND true = false`. לכן גם אדמין לא יכול לקרוא מהטבלה. בלוגים של Postgres ראיתי שגיאת `permission denied for table alert_events_queue`.

**פתרון**: הפיכת מדיניות האדמין ל-**permissive** (ברירת מחדל) כך שהיא תעקוף את המדיניות החוסמת.

### 2. בעיית תצוגה - הכרטיסיה נעלמת כש-0
בקוד `QueueHealthCard` (שורה 77):
```
if (!hasIssues) return null;
```
כשהתור ריק (0 ממתינות), הכרטיסיה מוסתרת לחלוטין. המשתמש מצפה לראות כרטיסיה עם "0".

**פתרון**: הצגת הכרטיסיה תמיד עם מצב ירוק כשהתור ריק.

## פרטים טכניים

### מיגרציה 1: תיקון RLS
```sql
-- מחיקת המדיניות הבעייתית
DROP POLICY "Admins can view queue" ON alert_events_queue;

-- יצירה מחדש כ-PERMISSIVE (ברירת מחדל)
CREATE POLICY "Admins can view queue"
  ON alert_events_queue FOR SELECT
  USING (is_admin());
```

### שינוי קוד: QueueHealthCard
- הסרת השורה `if (!hasIssues) return null;`
- הוספת מצב ירוק (תקין) שמציג "0 ממתינות - הכל תקין" כשהתור ריק
- שמירת כל הפונקציונליות הקיימת (כפתורי עיבוד, טבלה) כשיש בעיות

