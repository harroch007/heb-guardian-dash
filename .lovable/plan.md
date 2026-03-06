

## תיקון: באפר זמן ב-polling של heartbeat

### הבעיה
ה-`commandSentAt` נלקח מ-`new Date().toISOString()` (שעון הדפדפן), אבל ה-`reported_at` ב-DB מגיע מ-`coalesce(p_timestamp, now())` — שיכול להיות שעון האנדרואיד (Israel time = UTC+2/3). ה-filter `gt(commandSentAt)` מפספס את ה-heartbeat כי ה-timestamp של האנדרואיד מוקדם יותר מה-UTC של הדפדפן.

### התיקון
שורה 338 — הפחתת 30 שניות מ-`commandSentAt` כדי לכסות פערי שעון:

```typescript
// before:
const commandSentAt = new Date().toISOString();

// after:
const commandSentAt = new Date(Date.now() - 30000).toISOString();
```

שינוי של שורה אחת בלבד.

