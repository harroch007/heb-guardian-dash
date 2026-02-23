
# תיקון שגיאת 403 בהתחזות להורה שני

## הבעיה
כשה-iframe קורא ל-`supabase.auth.setSession()` עם הטוקן של ההורה, Supabase משדר את הסשן החדש דרך BroadcastChannel לכל הטאבים והפריימים באותו origin. החלון הראשי (האדמין) קולט את הסשן של ההורה ודורס את הסשן שלו. כשמנסים להתחזות להורה שני, ה-edge function מקבל טוקן של הורה (לא אדמין) ומחזיר 403.

## הפתרון
הפרדה מלאה של הסשן בתוך ה-iframe באמצעות `storageKey` ייחודי וכיבוי `detectSessionInUrl`. זה מונע את סנכרון ה-BroadcastChannel בין ה-iframe לחלון הראשי.

## שינויים

### 1. `src/integrations/supabase/client.ts`
- הוספת `storageKey` ייחודי כשרצים ב-iframe (`sb-impersonate-auth-token`)
- כיבוי `detectSessionInUrl` ב-iframe כדי למנוע התערבות בסשן

### 2. `src/pages/admin/AdminUsers.tsx`
- כשסוגרים את ה-iframe וממשיכים להתחזות להורה אחר, לא צריך שינוי נוסף -- הפתרון ב-client.ts מטפל בבעיה

## פרטים טכניים

שינוי ב-client.ts:

```text
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: isInIframe ? sessionStorage : localStorage,
    storageKey: isInIframe ? 'sb-impersonate-auth-token' : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !isInIframe,
  }
});
```

שני שינויים מרכזיים:
- **`storageKey`**: מפריד את ה-storage key של ה-iframe מזה של החלון הראשי, מה שמונע את ה-BroadcastChannel sync
- **`detectSessionInUrl: false`**: מונע מה-iframe לנסות לקרוא סשן מה-URL

