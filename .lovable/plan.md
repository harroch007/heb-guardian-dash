

## תיקון: שגיאה באישור משתמש מרשימת ההמתנה

### שורש הבעיה

כל ה-RLS policies בטבלאות `allowed_emails` ו-`waitlist_signups` מוגדרות כ-**RESTRICTIVE**. ב-PostgreSQL, כדי שגישה תינתן, חייבת להיות לפחות policy אחת **PERMISSIVE** שמתקיימת. אם יש רק restrictive policies — הגישה תמיד נדחית, גם אם `is_admin()` מחזיר `true`.

### תיקון

**מיגרציה חדשה** — שינוי הפוליסות מ-RESTRICTIVE ל-PERMISSIVE:

1. **`allowed_emails`** — מחיקת 3 הפוליסות הקיימות (INSERT, SELECT, DELETE) ויצירתן מחדש כ-PERMISSIVE
2. **`waitlist_signups`** — מחיקת 3 הפוליסות הקיימות (SELECT, UPDATE, INSERT) ויצירתן מחדש כ-PERMISSIVE

```sql
-- allowed_emails: drop restrictive, create permissive
DROP POLICY "Admins can insert allowed emails" ON allowed_emails;
DROP POLICY "Admins can view allowed emails" ON allowed_emails;
DROP POLICY "Admins can delete allowed emails" ON allowed_emails;

CREATE POLICY "Admins can insert allowed emails" ON allowed_emails FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can view allowed emails" ON allowed_emails FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete allowed emails" ON allowed_emails FOR DELETE TO authenticated USING (is_admin());

-- waitlist_signups: drop restrictive, create permissive
DROP POLICY "Admins can update waitlist" ON waitlist_signups;
DROP POLICY "Admins can view all waitlist" ON waitlist_signups;
DROP POLICY "Allow anonymous insert to waitlist" ON waitlist_signups;

CREATE POLICY "Admins can update waitlist" ON waitlist_signups FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can view all waitlist" ON waitlist_signups FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Allow anonymous insert to waitlist" ON waitlist_signups FOR INSERT TO anon, authenticated WITH CHECK (true);
```

לא נדרש שינוי בקוד — רק במסד הנתונים.

