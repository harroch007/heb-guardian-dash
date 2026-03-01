

## אבחון הבעיה

בדקתי את הלוגים של edge function `impersonate-user` ומצאתי שהוא החזיר **403 (Forbidden)** — כלומר ה-JWT הגיע אבל `is_admin()` החזיר false.

### מה קרה

לפי לוגי ה-auth:
1. **15:14** — התחברת כ-`yariv@kippyai.com` (אדמין)
2. **15:18:46** — התנתקת מהאדמין
3. **15:18:51** — התחברת כ-`yarivtm@gmail.com` (הורה)
4. **15:20** — ניסית להתחזות → Edge Function קיבל טוקן ללא הרשאת admin → 403

אחרי השינוי שלנו (הפרדת admin client), סשן האדמין הישן (ששמור תחת המפתח הישן ב-localStorage) לא זמין ל-`adminSupabase` שמחפש תחת `sb-admin-auth-token`. דף האדמין נשאר פתוח מהסשן הקודם אבל בפועל אין סשן אדמין תקף.

### הפתרון

הוספת בדיקת סשן אדמין לפני קריאת ההתחזות, עם הודעה ברורה אם הסשן פג:

**שינויים:**

1. **`src/pages/admin/AdminUsers.tsx`** — ב-`handleImpersonate`, לפני קריאת `functions.invoke`, לבדוק `adminSupabase.auth.getSession()`. אם אין סשן תקף → הודעת שגיאה "הסשן פג, יש להתחבר מחדש" והפניה ל-`/admin-login`.

2. **`src/pages/admin/AdminCustomerProfile.tsx`** — אותה בדיקה ב-`handleImpersonate`.

3. **`src/pages/Admin.tsx`** — הוספת listener ל-`adminSupabase.auth.onAuthStateChange` שמפנה ל-`/admin-login` כשהסשן מסתיים, כדי שדף האדמין לא יישאר פתוח בלי סשן.

### פרטים טכניים

```typescript
// Before calling functions.invoke:
const { data: { session } } = await adminSupabase.auth.getSession();
if (!session) {
  toast({ variant: 'destructive', title: 'הסשן פג', description: 'יש להתחבר מחדש' });
  navigate('/admin-login');
  return;
}
```

בנוסף, ב-Admin.tsx:
```typescript
useEffect(() => {
  const { data: { subscription } } = adminSupabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      navigate('/admin-login', { replace: true });
    }
  });
  return () => subscription.unsubscribe();
}, []);
```

### תוצאה
- אם סשן האדמין פג, המשתמש יקבל הודעה ברורה ויופנה להתחברות מחדש
- דף האדמין לא יישאר "תקוע" בלי סשן תקף
- ההתחזות תעבוד כרגיל אחרי התחברות מחדש

