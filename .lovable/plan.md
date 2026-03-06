

## תוכנית: חיווי תוצאה + רענון אוטומטי אחרי "בדוק הרשאות"

### הבעיה
הכפתור שולח את הפקודה בהצלחה, האנדרואיד מגיב ושולח heartbeat — אבל הדשבורד לא מתרענן ולא מראה את התוצאה החדשה.

### הפתרון
שני שינויים ב-`AdminCustomerProfile.tsx`:

1. **Polling אחרי לחיצה** — אחרי ה-INSERT המוצלח, הכפתור נשאר במצב "ממתין..." (עם ספינר וטקסט "ממתין לתשובה..."), ומתחיל polling כל 3 שניות למשך 30 שניות על `device_heartbeats_raw` לאותו `device_id`. ברגע שמופיע heartbeat חדש (עם `reported_at` > הזמן שבו נשלחה הפקודה):
   - מעדכן את ה-`childrenDetails` state עם ה-heartbeat החדש
   - מציג toast הצלחה "התקבל דיווח הרשאות מהמכשיר ✓"
   - מחזיר את הכפתור למצב רגיל
   - אם עברו 30 שניות בלי תשובה — toast אזהרה "המכשיר לא הגיב, ייתכן שאינו מחובר"

2. **עדכון ה-heartbeat data ב-state** — כשהpolling מקבל תוצאה, מעדכן ישירות את ה-badges של ההרשאות בממשק (ללא צורך בסגירה ופתיחה מחדש של הפרופיל).

### שינויים טכניים

| # | מה | איפה |
|---|---|---|
| 1 | שינוי `handleRequestHeartbeat` — אחרי INSERT מוצלח, הפעלת polling loop | `AdminCustomerProfile.tsx` שורות 315-329 |
| 2 | הוספת state `awaitingHeartbeat` (Record<string, boolean>) לחיווי "ממתין לתשובה" | ליד שורה 157 |
| 3 | עדכון טקסט הכפתור — "ממתין לתשובה..." כש-awaiting | שורות 831-840 |

### לוגיקת ה-polling

```typescript
const commandSentAt = new Date().toISOString();
// poll every 3s for up to 30s
const interval = setInterval(async () => {
  const { data } = await adminSupabase
    .from("device_heartbeats_raw")
    .select("device, permissions, reported_at")
    .eq("device_id", deviceId)
    .gt("reported_at", commandSentAt)
    .order("reported_at", { ascending: false })
    .limit(1);
  if (data?.length) {
    // update childrenDetails state with new heartbeat
    clearInterval(interval);
    // success toast + reset state
  }
}, 3000);
// timeout after 30s
setTimeout(() => { clearInterval(interval); /* warning toast */ }, 30000);
```

