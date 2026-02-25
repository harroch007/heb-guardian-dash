

## חיבור Resend כספק אימיילים

### מה נדרש

1. **הרשמה ב-Resend** — אם עדיין אין לך חשבון, היכנס ל-[resend.com](https://resend.com) וצור חשבון
2. **אימות דומיין** — ב-[resend.com/domains](https://resend.com/domains) יש לאמת את הדומיין שממנו ישלחו האימיילים (למשל `kippyai.com`)
3. **יצירת API Key** — ב-[resend.com/api-keys](https://resend.com/api-keys) צור מפתח API
4. **שמירת הסוד** — נשמור את ה-`RESEND_API_KEY` כ-secret בסופאבייס

### שלבים טכניים

- שמירת `RESEND_API_KEY` כ-Supabase secret
- יצירת Edge Function `send-email` שמשתמש ב-Resend לשליחת אימיילי אימות (magic link, איפוס סיסמה וכו׳)
- יצירת תבנית React Email מותאמת עם הלוגו של KippyAI בעברית ו-RTL
- הגדרת Auth Hook בסופאבייס כדי שאימיילי האימות ישלחו דרך Resend

### הערה חשובה

מערכת האימיילים תומכת **רק באימיילי אימות** (magic link, איפוס סיסמה, אימות אימייל). לא מתאים לאימיילים שיווקיים או טרנזקציוניים.

### האם להמשיך?

לפני שאתחיל — האם יש לך כבר חשבון ב-Resend עם דומיין מאומת ו-API Key מוכן?

