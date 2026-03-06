

## תיקון מערכתי: Polling לפי ID במקום timestamp

### הבעיה
`reported_at` ב-DB מגיע מהאנדרואיד (Israel time UTC+2) או מ-`now()` של Supabase (UTC). הדפדפן שולח `commandSentAt` ב-UTC. הפער קבוע של שעתיים, ובאפר של 30 שניות לא מספיק.

### הפתרון הפשוט ביותר
**לפני שליחת הפקודה** — שלוף את ה-`id` האחרון של heartbeat למכשיר. ב-polling — חפש heartbeat עם `id` גבוה יותר. ה-`id` הוא `bigint serial` ותמיד עולה, ללא תלות בשעונים.

### שינוי אחד ב-`AdminCustomerProfile.tsx` (שורות 338-351)

**לפני:**
```typescript
const commandSentAt = new Date(Date.now() - 30000).toISOString();
// ... polling with .gt("reported_at", commandSentAt)
```

**אחרי:**
```typescript
// Fetch last heartbeat ID before sending command
const { data: lastHb } = await adminSupabase
  .from("device_heartbeats_raw")
  .select("id")
  .eq("device_id", deviceId)
  .order("id", { ascending: false })
  .limit(1);
const lastHbId = lastHb?.[0]?.id ?? 0;

// ... in polling:
.gt("id", lastHbId)  // instead of .gt("reported_at", commandSentAt)
```

אין תלות בשעונים כלל. עובד גם ל-`check-device-health` edge function וכל מקום אחר שמשווה timestamps.

