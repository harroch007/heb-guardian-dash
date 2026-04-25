## עדכון יעדי ניווט לאחר התנתקות

החלפת `/` ב-`/landing-v1` בכל מקומות ההתנתקות והדחייה:

1. **`src/pages/SettingsV2.tsx`** — `navigate('/')` → `navigate('/landing-v1')` ב-`handleSignOut`.
2. **`src/pages/Settings.tsx`** — `navigate('/')` → `navigate('/landing-v1')` ב-`handleSignOut`.
3. **`src/components/AppSidebar.tsx`** — `window.location.href = "/"` → `window.location.href = "/landing-v1"` במצב דמו.
4. **`src/contexts/AuthContext.tsx`**:
   - חשבון נעול: `navigate('/', { replace: true })` → `navigate('/landing-v1', { replace: true })`.
   - דחיית waitlist: `navigate('/', { replace: true })` → `navigate('/landing-v1', { replace: true })`.

לוגיקת `signOut()` עצמה לא משתנה. הניווט שאחרי לוגין (`/home-v2`) ולחיצה על הלוגו (`/dashboard`) נשארים כמו שהם.