
# כלי התחזות (Impersonation) לאדמין

## סיכום
נוסיף כפתור "היכנס כהורה" ליד כל משתמש בטבלת המשתמשים באדמין. לחיצה תפתח טאב חדש בדפדפן עם סשן של אותו הורה, כך שתוכל לראות בדיוק מה הוא רואה ולנווט באפליקציה כאילו נכנסת מהחשבון שלו.

## איך זה עובד

```text
+-------------------+     Edge Function      +-------------------+
|   דשבורד אדמין    | ----> impersonate-user  |   טאב חדש בדפדפן  |
|   כפתור "היכנס    |      (service_role)     |   עם סשן ההורה    |
|    כהורה"         | <---- access_token      |   /dashboard      |
+-------------------+                         +-------------------+
```

1. אדמין לוחץ "היכנס כהורה" ליד משתמש
2. Edge Function מאמת שהקורא הוא אדמין, ויוצר access token להורה באמצעות service_role
3. נפתח טאב חדש עם URL מיוחד (`/auth?impersonate=TOKEN`) שמכניס את הטוקן ומעביר לדשבורד

## מה ייבנה

### 1. Edge Function חדשה: `impersonate-user`
- מקבלת `{ userId: string }`
- מאמתת שהקורא הוא אדמין (דרך JWT + `is_admin()` RPC)
- קוראת ל-`supabase.auth.admin.generateLink({ type: 'magiclink', email })` עם service role key
- מחזירה access token + refresh token
- **אבטחה**: רק אדמין מאומת יכול להשתמש

### 2. שינוי בטבלת משתמשים (`AdminUsers.tsx`)
- הוספת עמודה חדשה "פעולות" בטבלה
- כפתור `UserCheck` icon + "היכנס כהורה" לכל שורה
- לחיצה שולחת בקשה ל-Edge Function ופותחת טאב חדש

### 3. שינוי בעמוד Auth (`Auth.tsx`)
- זיהוי query param `?impersonate_token=...`
- אם קיים, קריאה ל-`supabase.auth.setSession()` עם הטוקן
- ניווט אוטומטי לדשבורד

### 4. באנר התחזות
- רכיב `ImpersonationBanner.tsx` שמוצג בראש הדשבורד כשמזוהה סשן התחזות
- כפתור "חזור לאדמין" שמנתק את הסשן וחוזר לטאב האדמין
- צבע בולט (כתום/צהוב) כדי שלא תשכח שאתה בהתחזות

## פרטים טכניים

### Edge Function `impersonate-user`:
- `verify_jwt = false` ב-config.toml (כמו שאר הפונקציות)
- אימות פנימי: קריאת JWT מה-Authorization header, בדיקת `is_admin()`
- שימוש ב-`supabase.auth.admin.getUserById()` לקבלת אימייל ההורה
- יצירת Magic Link עם `supabase.auth.admin.generateLink()`

### קבצים שישתנו:
1. **`supabase/functions/impersonate-user/index.ts`** -- חדש
2. **`supabase/config.toml`** -- הוספת הפונקציה החדשה
3. **`src/pages/admin/AdminUsers.tsx`** -- הוספת כפתור התחזות
4. **`src/pages/Auth.tsx`** -- טיפול ב-impersonation token
5. **`src/components/ImpersonationBanner.tsx`** -- חדש: באנר אזהרה
6. **`src/components/DashboardLayout.tsx`** -- הטמעת באנר ההתחזות

### אבטחה:
- רק משתמש עם role=admin יכול להפעיל את ה-Edge Function
- הטוקן שנוצר הוא סשן רגיל של ההורה (לא admin)
- באנר ברור מסמן שאתה במצב התחזות
- אין שמירת לוגים של ההתחזות (אפשר להוסיף בעתיד)
