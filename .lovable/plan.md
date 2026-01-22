
# תיקון: PWA לא זוכר את ההתחברות בפתיחה מחדש

## הבעיה
כשסוגרים את ה-PWA ופותחים מחדש, המשתמש רואה את דף הבית במקום להיכנס ישירות ל-Dashboard.

## הסיבה
שתי בעיות משולבות:

1. **`start_url: '/'`** - ה-PWA תמיד נפתח בדף Landing
2. **`WAITLIST_MODE = true`** - כש-Waitlist mode פעיל, דף ה-Landing לא מפנה משתמשים מחוברים ל-Dashboard

## הפתרון

### שינוי 1: עדכון `start_url` ב-PWA
**קובץ:** `vite.config.ts` (שורה 32)

```typescript
start_url: '/dashboard',  // ← שינוי מ-'/'
```

**למה?** כשמשתמש מחובר פותח את ה-PWA, הוא צריך להגיע ישירות ל-Dashboard. אם הוא לא מחובר, ה-ProtectedRoute יפנה אותו לדף ההתחברות.

### שינוי 2: Landing page צריך להפנות גם ב-Waitlist mode
**קובץ:** `src/pages/Landing.tsx` (שורות 27-42)

```typescript
useEffect(() => {
  // Redirect to dashboard if user is logged in
  // (works in both waitlist mode and regular mode)
  if (!loading && user) {
    navigate('/dashboard', { replace: true });
  }
}, [user, loading, navigate]);

// Show nothing while checking auth
if (loading) {
  return null;
}

// If user is logged in, they'll be redirected
if (user) {
  return null;
}
```

**למה?** גם כש-Waitlist mode פעיל, משתמש שכבר עבר את הבדיקה ומחובר צריך להיות מופנה ל-Dashboard.

## סיכום
| קובץ | שינוי |
|------|-------|
| `vite.config.ts` | `start_url: '/dashboard'` |
| `src/pages/Landing.tsx` | הסרת התנאי `!WAITLIST_MODE` מההפניה ל-Dashboard |
