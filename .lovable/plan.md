
# תיקון כלי ההתחזות - iframe תקוע על "מתחבר כהורה..."

## הבעיות שזוהו

### 1. קונפליקט localStorage (הבעיה המרכזית)
ה-iframe נטען מאותו origin כמו עמוד האדמין. שניהם חולקים את אותו localStorage. כשה-iframe קורא ל-`supabase.auth.setSession()` עם טוקנים של ההורה, זה **דורס את הסשן של האדמין** ב-localStorage. התוצאה: שני הצדדים מתבלבלים.

### 2. AuthProvider + WaitlistRouteGuard מפריעים
הנתיב `/impersonate-session` עובר דרך `WaitlistRouteGuard` ו-`AuthProvider` שמנסים לבדוק הרשאות, allowlist, וסטטוס הורה -- מה שגורם להפרעות בזמן שה-iframe מנסה להגדיר סשן חדש.

### 3. תזמון postMessage לא אמין
`setTimeout` של 1000ms לא מבטיח שה-iframe סיים לטעון. אם ה-JS של ה-iframe עוד לא רץ כשההודעה נשלחת -- היא פשוט אובדת.

---

## הפתרון

### 1. ImpersonateSession ישתמש ב-supabase client נפרד
במקום לייבא את ה-client הגלובלי (שמשתמש ב-localStorage), ניצור client מקומי שמשתמש ב-**sessionStorage** (או `memoryStorage`). כך הסשן של ההורה לא ידרוס את הסשן של האדמין.

### 2. הוצאת הנתיב מחוץ ל-AuthProvider
נעביר את `/impersonate-session` מ-`AppRoutes` (שעטופה ב-AuthProvider + WaitlistRouteGuard) לרמת ה-Routes העליונה ב-`App.tsx`, ליד נתיבי האדמין.

### 3. שימוש ב-iframe.onload במקום setTimeout
נחליף את `setTimeout(1000)` ב-event handler על ה-iframe `onLoad`, כך שהטוקנים יישלחו רק אחרי שה-iframe באמת סיים לטעון.

### 4. DialogTitle נגישות
נוסיף `DialogTitle` מוסתר כדי לתקן את אזהרת ה-accessibility בקונסול.

---

## קבצים שישתנו

### 1. `src/pages/ImpersonateSession.tsx`
- ייצור supabase client מקומי עם `storage: sessionStorage` (לא localStorage)
- לא ייבא מ-`@/integrations/supabase/client`
- ישתמש בטוקנים מ-postMessage כמו היום, אבל עם client נפרד

### 2. `src/App.tsx`
- העברת route `/impersonate-session` מתוך `AppRoutes` לרמה העליונה (ליד `/admin`)
- כך הנתיב לא עובר דרך WaitlistRouteGuard ו-AuthProvider

### 3. `src/pages/admin/AdminUsers.tsx`
- החלפת `setTimeout(1000)` ב-`onLoad` event על ה-iframe
- שמירת הטוקנים ב-state ושליחתם כשה-iframe מוכן
- הוספת `DialogTitle` מוסתר לנגישות

### 4. `src/components/DashboardLayout.tsx`
- ה-`ImpersonationBanner` צריך לבדוק sessionStorage (לא localStorage) כדי לזהות מצב התחזות בתוך ה-iframe

---

## פרטים טכניים

### Client נפרד ב-ImpersonateSession:
```text
const impersonateClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: sessionStorage,   // <-- לא localStorage
    persistSession: true,
    autoRefreshToken: true,
  }
})
```
כך הסשן של ההורה נשמר רק ב-sessionStorage של ה-iframe (שהוא נפרד מה-sessionStorage של החלון הראשי).

### תזמון iframe:
```text
AdminUsers:
  1. invoke edge function -> get tokens
  2. open dialog + iframe
  3. store tokens in pendingTokensRef
  4. iframe onLoad -> sendTokensToIframe(pendingTokensRef.current)
```

### ProtectedRoute בתוך ה-iframe:
ה-iframe מנווט ל-`/dashboard` אחרי setSession. ה-dashboard עטוף ב-ProtectedRoute שמשתמש ב-AuthProvider. אבל מכיוון שה-iframe הוא חלון נפרד עם context נפרד, ה-AuthProvider שלו יזהה את הסשן מ-sessionStorage ויעבוד כרגיל -- בלי להשפיע על האדמין.

**הערה חשובה**: מכיוון שה-iframe טוען את כל האפליקציה (כולל AuthProvider), צריך לוודא שה-supabase client הגלובלי שמשמש את AuthProvider גם יקרא מ-sessionStorage כשנמצאים ב-iframe. הפתרון: נבדוק אם אנחנו בתוך iframe (`window.self !== window.top`) ואם כן, נגדיר את ה-client הגלובלי להשתמש ב-sessionStorage.

### שינוי ב-`src/integrations/supabase/client.ts`:
- זיהוי אם רצים בתוך iframe
- אם כן, שימוש ב-sessionStorage במקום localStorage
- כך כל האפליקציה בתוך ה-iframe (כולל AuthProvider, ProtectedRoute, Dashboard) תעבוד עם sessionStorage ולא תדרוס את סשן האדמין
