

## תיקון אבטחה: הסרת Anon SELECT policy מ-reward_transactions

### מיגרציה חדשה

קובץ: `supabase/migrations/[timestamp]_drop_anon_reward_transactions_policy.sql`

```sql
DROP POLICY IF EXISTS "Anon read reward_transactions" ON public.reward_transactions;
```

### תוצאה צפויה

אחרי ההרצה, נשארת רק policy אחת לקריאה:

```
Policy Name: Parents read reward_transactions
Command: SELECT
Roles: authenticated
USING: child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid())
```

### קבצים שישתנו
1. מיגרציה חדשה בלבד (שורה אחת של SQL)

### אין צורך בשינוי קוד
הקוד ב-`useChores.ts` כבר משתמש ב-supabase client עם authenticated session, ולכן ה-policy של Parents תמשיך לעבוד.

