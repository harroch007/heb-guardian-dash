

# שיפור כלי ההתחזות - iframe פנימי עם חיבור אוטומטי

## סיכום
נשנה את כלי ההתחזות כך שבמקום לפתוח טאב חדש עם מסך לוגין, ייפתח iframe בתוך ממשק האדמין עם חיבור אוטומטי לחשבון ההורה.

## מה ישתנה

### 1. Edge Function (`impersonate-user/index.ts`)
- במקום להחזיר token של magic link, הפונקציה תבצע אימות (verify) בצד השרת ותחזיר **access_token + refresh_token** מוכנים לשימוש
- כך לא צריך לעבור דרך מסך לוגין כלל

### 2. עמוד ביניים חדש (`src/pages/ImpersonateSession.tsx`)
- עמוד מינימלי ב-route `/impersonate-session`
- מקבל tokens דרך `postMessage` מהעמוד האב (האדמין)
- קורא ל-`supabase.auth.setSession()` עם הטוקנים
- שומר סימון `impersonating` ב-sessionStorage
- מנווט לדשבורד ההורה

### 3. ממשק האדמין (`AdminUsers.tsx`)
- במקום `window.open()` ייפתח Dialog/Sheet עם iframe בתוך הממשק
- ה-iframe יטען את `/impersonate-session` וישלח לו את הטוקנים דרך `postMessage`
- כפתור "סגור" לסגירת ה-iframe
- באנר צהוב מעל ה-iframe עם שם ההורה

### 4. רישום Route חדש (`App.tsx`)
- הוספת route `/impersonate-session` שמצביע לעמוד החדש

## פרטים טכניים

### זרימה:

```text
AdminUsers          Edge Function              ImpersonateSession (iframe)
    |                     |                              |
    |-- invoke() -------->|                              |
    |                     |-- verifyOtp() internally     |
    |<-- {access, refresh}|                              |
    |                     |                              |
    |-- open iframe ----->|                              |
    |-- postMessage({tokens}) -------------------------->|
    |                     |         setSession(tokens)   |
    |                     |         navigate(/dashboard) |
    |                     |              |               |
    |       [iframe shows parent dashboard]              |
```

### Edge Function - שינוי מרכזי:
- קריאה ל-`generateLink()` כמו היום
- חילוץ ה-token מה-action_link
- קריאה ל-`verifyOtp({ token_hash, type: 'magiclink' })` בצד השרת
- החזרת `session.access_token` + `session.refresh_token` ישירות

### אבטחת postMessage:
- ה-iframe בודק `event.origin` מול `window.location.origin`
- רק הודעות מאותו origin מתקבלות

### קבצים שישתנו:
1. **`supabase/functions/impersonate-user/index.ts`** -- שינוי: החזרת session tokens
2. **`src/pages/ImpersonateSession.tsx`** -- חדש: עמוד ביניים ל-iframe
3. **`src/pages/admin/AdminUsers.tsx`** -- שינוי: iframe + dialog במקום window.open
4. **`src/App.tsx`** -- הוספת route חדש

