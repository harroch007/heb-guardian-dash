
# תיקון שמירת ה-Session אחרי Login/Refresh

## הבעיה
אחרי התחברות, רענון הדף לא שומר את ה-session. זה קורה כי:
1. חסר `detectSessionInUrl: true` בהגדרות ה-Supabase client
2. ה-OAuth redirect הולך ישירות ל-`/dashboard` במקום להעביר דרך `/auth`

## השינויים הנדרשים

### שינוי 1: עדכון Supabase Client
**קובץ:** `src/integrations/supabase/client.ts`

```typescript
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,  // ← הוספה
  }
});
```

### שינוי 2: תיקון OAuth Redirect
**קובץ:** `src/pages/Auth.tsx` (שורה 243)

```typescript
const handleGoogleAuth = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth`,  // ← שינוי מ-/dashboard ל-/auth
    },
  });
};
```

**למה `/auth`?** כי שם יש את הלוגיקה שבודקת את ה-session ומפנה ל-dashboard. אם נפנה ישירות ל-dashboard, ה-tokens מה-URL לא מעובדים נכון.

## סיכום
- שורה אחת להוספה ב-client.ts
- שורה אחת לשינוי ב-Auth.tsx
