

## תיקון: בדיקת גרסה לפי heartbeat אחרון בלבד

### הבעיה
השאילתה הנוכחית שולפת **את כל** ה-heartbeats של כל מכשירי הפרימיום:
```ts
.select("device_id, device")
.in("device_id", premiumDeviceIds)
```
- סופאבייס מגביל ל-1000 שורות כברירת מחדל — אם יש הרבה heartbeats, לא כולם חוזרים
- מכשיר שהגרסה שלו **כרגע** היא 1.8+ עלול להיראות כ"לא שדרג" כי ה-heartbeat הרלוונטי לא נכלל ב-1000 השורות

### הפתרון
לכל מכשיר, נשלוף רק את ה-**heartbeat האחרון** ונבדוק את הגרסה שלו. במקום שאילתה אחת גדולה, נעשה שאילתה **לכל מכשיר בנפרד** עם `.order("reported_at", { ascending: false }).limit(1)`, או לחלופין נשלוף את כולם עם `.order("reported_at")` ונשמור רק את האחרון בצד הקליינט.

**גישה מועדפת**: שאילתה אחת עם סדר יורד + עיבוד קליינט — לכל `device_id` נשמור רק את ה-heartbeat הראשון (האחרון כרונולוגית):

```ts
const { data: heartbeats } = await adminSupabase
  .from("device_heartbeats_raw")
  .select("device_id, device")
  .in("device_id", premiumDeviceIds)
  .order("reported_at", { ascending: false })
  .limit(premiumDeviceIds.length * 1);  // heartbeat אחד לכל מכשיר - מספיק
```

**אבל** זה לא מבטיח heartbeat אחד לכל מכשיר. הפתרון הנכון:

שולפים עם `limit` גבוה מספיק, ובקליינט שומרים רק את ה-heartbeat הראשון (=אחרון כרונולוגית) לכל device_id:

```ts
const { data: heartbeats } = await adminSupabase
  .from("device_heartbeats_raw")
  .select("device_id, device, reported_at")
  .in("device_id", premiumDeviceIds)
  .order("reported_at", { ascending: false });

const latestByDevice = new Map<string, any>();
(heartbeats || []).forEach((hb: any) => {
  if (!latestByDevice.has(hb.device_id)) {
    latestByDevice.set(hb.device_id, hb);
  }
});

const upgradedIds = new Set<string>();
latestByDevice.forEach((hb, deviceId) => {
  const versionCode = hb.device?.appVersionCode;
  if (typeof versionCode === 'number' && versionCode >= 8) {
    upgradedIds.add(deviceId);
  }
});
```

### קובץ
`src/pages/admin/AdminUsers.tsx` — שינוי בלוק ה-useEffect של ספירת השדרוג בלבד.

