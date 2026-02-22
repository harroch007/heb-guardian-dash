

# תיקון שגיאת "לא ניתן לשמור משוב" בהתראות

## הבעיה

כל מדיניות ה-RLS בטבלת `alert_feedback` מוגדרת כ-RESTRICTIVE (לא permissive). ב-PostgreSQL, מדיניות restrictive רק מצמצמת גישה שניתנה על ידי מדיניות permissive. אם אין אף מדיניות permissive -- כל הפעולות נחסמות, גם INSERT וגם SELECT.

לכן לחיצה על "רלוונטי" תמיד נכשלת.

## הפתרון

### 1. תיקון RLS על alert_feedback (מיגרציה)

מחיקת כל ה-policies הקיימות ויצירתן מחדש כ-PERMISSIVE:

```sql
DROP POLICY IF EXISTS "Parents can insert own feedback" ON alert_feedback;
DROP POLICY IF EXISTS "Parents can select own feedback" ON alert_feedback;
DROP POLICY IF EXISTS "Parents can update own feedback" ON alert_feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON alert_feedback;

CREATE POLICY "Parents can insert own feedback" ON alert_feedback
  FOR INSERT TO authenticated WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Parents can select own feedback" ON alert_feedback
  FOR SELECT TO authenticated USING (parent_id = auth.uid());

CREATE POLICY "Parents can update own feedback" ON alert_feedback
  FOR UPDATE TO authenticated USING (parent_id = auth.uid());

CREATE POLICY "Admins can view all feedback" ON alert_feedback
  FOR SELECT TO authenticated USING (is_admin());
```

### 2. תיקון קטן ב-AlertFeedback.tsx

הוספת בדיקה שה-`parentId` לא ריק לפני ניסיון שמירה, כדי לתת הודעה ברורה יותר.

שינוי אחד בלבד: קובץ `supabase/functions` לא נדרש -- הכל DB + קומפוננטת React.
