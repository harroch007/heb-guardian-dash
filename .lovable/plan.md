

# הפניית ניווט מ-/dashboard ל-/home-v2

## הבעיה
כשהורה נכנס לאפליקציה, כל ההפניות מובילות ל-`/dashboard` (המסך הישן) במקום ל-`/home-v2` (המסך החדש).

## מקומות שדורשים שינוי

### 1. `src/pages/Landing.tsx` (שורה 31)
- `navigate('/dashboard')` → `navigate('/home-v2')`

### 2. `src/pages/Auth.tsx` (שורות 55, 100, 154, 167, 199)
- כל 5 המופעים של `navigate('/dashboard')` → `navigate('/home-v2')`

### 3. `src/components/ProtectedRoute.tsx` (שורה 32)
- `Navigate to="/dashboard"` → `Navigate to="/home-v2"` (redirect אחרי onboarding)

### 4. `src/pages/Onboarding.tsx` (שורה 95)
- `navigate('/family')` → `navigate('/home-v2')` (אחרי סיום onboarding)

### 5. `src/pages/ImpersonateSession.tsx` (שורה 31)
- `navigate("/dashboard")` → `navigate("/home-v2")`

### 6. `src/pages/DailyReport.tsx` (שורות 88, 246)
- הפניות חזרה ל-dashboard → `/home-v2`

### 7. `src/pages/PeriodicSummary.tsx` (שורה 94)
- הפניה חזרה ל-dashboard → `/home-v2`

### 8. PWA start_url
- בדיקה ב-`vite.config.ts` שה-start_url מוגדר ל-`/` (כבר נכון — Landing.tsx מטפל בהפניה)

## תוצאה
הורה מחובר תמיד יגיע ל-`/home-v2` — מהלוגין, מהלנדינג, מה-onboarding, ומכל מסך שמחזיר "חזרה לדשבורד".

