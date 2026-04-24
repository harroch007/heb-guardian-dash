

# תיקון build: העלאת סף ה-PWA precache

## השינוי
ב-`vite.config.ts` להוסיף `workbox` config לתוך `VitePWA` plugin עם `maximumFileSizeToCacheInBytes: 5 * 1024 * 1024` (5MB).

```ts
VitePWA({
  // ... existing config
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
  },
  // ...
})
```

הערה: כיוון שהפרויקט משתמש ב-`strategies: 'injectManifest'`, האופציה צריכה להיכנס תחת `injectManifest` (לא תחת `workbox`).

## תוצאה
- ה-build יעבור.
- האזהרה "Assets exceeding the limit" תיעלם.
- ה-bundle הראשי (2.1MB) ייכנס ל-precache כרגיל.

## מה לא נוגעים
- אין שינוי בקוד אפליקציה.
- אין שינוי ב-`ChildCardV2` שכבר עובד.
- אין שינוי בלוגיקה/DB.

## קובץ שיתעדכן
- `vite.config.ts` — הוספת שורה אחת ל-`injectManifest`.

