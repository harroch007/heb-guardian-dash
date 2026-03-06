

## תיקון: Race Condition בסדר הפעולות

### הבעיה
הקוד הנוכחי:
1. שולח פקודת REPORT_HEARTBEAT (שורה 327)
2. **אחרי זה** שולף את ה-ID האחרון (שורה 339)
3. מחפש heartbeat עם ID גבוה יותר

אם המכשיר מגיב מהר (תוך מילישניות), ה-heartbeat החדש כבר נכתב ל-DB לפני שלב 2. אז `lastHbId` = ה-ID של ה-heartbeat החדש, וה-polling מחפש ID גבוה יותר — שלא קיים. אחרי 30 שניות → "המכשיר לא הגיב".

### התיקון
שורות 327-345 — להזיז את שליפת ה-baseline ID **לפני** שליחת הפקודה:

```typescript
const handleRequestHeartbeat = async (deviceId: string) => {
  setRequestingHeartbeat(prev => ({ ...prev, [deviceId]: true }));
  try {
    // 1. Fetch baseline FIRST (before command)
    const { data: lastHb } = await adminSupabase
      .from("device_heartbeats_raw")
      .select("id")
      .eq("device_id", deviceId)
      .order("id", { ascending: false })
      .limit(1);
    const lastHbId = lastHb?.[0]?.id ?? 0;

    // 2. THEN send the command
    const { error } = await adminSupabase.from("device_commands").insert({
      device_id: deviceId,
      command_type: "REPORT_HEARTBEAT",
      status: "PENDING",
    } as any);
    if (error) throw error;

    // rest stays the same...
```

שינוי של סדר הפעולות בלבד — אותו קוד, סדר שונה.

