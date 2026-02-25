

## בעיית ניתוק תכוף — שני חשבונות באותו דפדפן

### הבעיה

שני הטאבים (אדמין + הורה) משתמשים באותו `localStorage` key של Supabase Auth. כשטאב אחד מרענן את ה-refresh token, הוא מבטל את הטוקן של הטאב השני — וזה גורם לשגיאת `refresh_token_not_found` ולניתוק.

### הפתרון

ליצור Supabase client נפרד לאדמין עם `storageKey` ייחודי, כך ששני החשבונות חיים ב-localStorage בלי להתנגש.

### שינויים נדרשים

**1. קובץ חדש: `src/integrations/supabase/admin-client.ts`**
- יצירת client נפרד עם `storageKey: 'sb-admin-auth-token'`
- אותו URL ו-anon key, רק storage key שונה

**2. עדכון `src/pages/AdminLogin.tsx`**
- שימוש ב-`adminSupabase` במקום `supabase` רגיל

**3. עדכון `src/components/AdminRoute.tsx`**
- שימוש ב-`adminSupabase` לבדיקת הרשאות

**4. עדכון `src/pages/Admin.tsx`**
- שימוש ב-`adminSupabase` (או העברת context מתאים)

**5. עדכון כל קומפוננטות האדמין** שמשתמשות ב-`supabase` ישירות
- החלפת import ל-admin client בדפי admin

### תוצאה

- חשבון הורה שומר טוקן ב-`sb-fsedenvbdpctzoznppwo-auth-token` (ברירת מחדל)
- חשבון אדמין שומר טוקן ב-`sb-admin-auth-token`
- אין עוד התנגשויות refresh token בין הטאבים

