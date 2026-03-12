

## תוכנית: כפתור "קרא למכשיר" (Ring Device)

### רעיון
ההורה לוחץ כפתור → נשלחת פקודת `RING_DEVICE` לטבלת `device_commands` → אפליקציית האנדרואיד מזהה את הפקודה ומשמיעה צליל בעוצמה מלאה גם אם המכשיר על שקט → ההורה רואה סטטוס (ממתין / מצלצל / נכשל).

---

### צד Web (UI)

**קובץ: `src/pages/ChildDashboard.tsx`**
- הוספת כפתור "קרא למכשיר" (עם אייקון `Volume2` או `Phone`) בסקשן המיקום או כפעולה עצמאית ליד כפתור "אתר עכשיו"
- שימוש חוזר בדפוס הקיים של `handleLocateNow` — state חדש `ringStatus` + `ringCommandId` + `ringPollingRef`
- הכפתור מכניס שורה ל-`device_commands` עם `command_type: "RING_DEVICE"`
- פולינג על הסטטוס עם timeout של 2 דקות (כמו locate/sync)
- מצבי UI: "מצלצל..." (spinner) → "המכשיר מצלצל ✓" (הצלחה) → "המכשיר לא מגיב" (כישלון)

**מיקום בממשק**: כפתור נוסף בשורה של "אתר עכשיו" בתוך `LocationSection`, או כפעולה נפרדת מעל הסקשנים

---

### צד Supabase

**אין שינוי בסכמה** — טבלת `device_commands` כבר תומכת בכל `command_type` כ-string חופשי. פשוט נשתמש ב-`"RING_DEVICE"`.

---

### מה לבקש מסוכן האנדרואיד

הסוכן צריך לממש handler ל-`command_type = "RING_DEVICE"` שעושה את הדברים הבאים:

1. **זיהוי הפקודה**: להאזין ב-Realtime (או בפולינג) לשורות חדשות ב-`device_commands` עם `command_type = 'RING_DEVICE'` ו-`status = 'PENDING'`

2. **עדכון סטטוס**: מיד כשמקבל → לעדכן `status = 'ACKNOWLEDGED'`

3. **השמעת צליל בעוצמה מלאה**:
   - לשמור את הגדרות הווליום הנוכחיות של המכשיר (ringtone stream)
   - להעביר את ה-`AudioManager` למצב `STREAM_RING` בעוצמה מקסימלית
   - להשתמש ב-`RingtoneManager.getDefaultUri(TYPE_ALARM)` או `TYPE_RINGTONE` להשמעת צליל
   - להפעיל את הצליל למשך 30 שניות (או עד שהמשתמש מכבה)
   - **חשוב**: להשתמש ב-`AudioManager.setStreamVolume(STREAM_ALARM, maxVolume, 0)` כדי לעקוף מצב שקט/רטט

4. **אפשרות עצירה**: הילד יכול ללחוץ על נוטיפיקציה או כפתור על המסך כדי לעצור את הצלצול

5. **עדכון סיום**: כשהצליל התחיל בהצלחה → `status = 'COMPLETED'`. אם נכשל → `status = 'FAILED'` עם `result` שמסביר למה

6. **שחזור**: אחרי העצירה, להחזיר את הווליום למצב המקורי

**Android permissions נדרשות**: אין הרשאות נוספות — `AudioManager` ו-`RingtoneManager` לא דורשים הרשאה מיוחדת. אם רוצים לעקוף Do Not Disturb צריך `ACCESS_NOTIFICATION_POLICY`.

---

### סיכום

| רכיב | עבודה |
|-------|-------|
| Web UI | כפתור + polling (דפוס קיים, ~50 שורות) |
| Supabase | אין שינוי |
| Android | handler חדש ל-`RING_DEVICE` עם AudioManager |

