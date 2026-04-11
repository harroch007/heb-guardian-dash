

# תוכנית: סגירת פערי הסנכרון — משימות ובקשות זמן

## מה מצאתי

### מה כבר עובד
- ה-RPCs `complete_chore` ו-`request_extra_time` כבר מוגנים עם authorize_device_call
- ה-RLS על טבלת `chores` כבר מאפשר `anon` לקרוא (SELECT) ולעדכן סטטוס ל-`completed_by_child`
- המכשיר מחובר ומדווח (last_seen לפני דקות)
- המשימה "לזרוק את הזבל" קיימת בסטטוס `pending`

### מה חסר — 3 פערים ברורים

**פער 1: הורה יוצר משימה → המכשיר לא יודע**
הפונקציה `addChore` ב-`useChores.ts` מוסיפה שורה ל-`chores` אבל **לא שולחת `REFRESH_SETTINGS`** למכשיר. המכשיר ידע על משימה חדשה רק בפולינג הבא (יכול לקחת 15+ דקות).

**פער 2: `TimeRequestsCard` לא מאזין ל-Realtime**
הרכיב טוען בקשות זמן פעם אחת (`useEffect` ללא subscription). ההורה לא רואה בקשה חדשה עד רענון ידני.

**פער 3: הורה מאשר/דוחה משימה → המכשיר לא יודע**
`approveChore` ו-`rejectChore` לא שולחים `REFRESH_SETTINGS` למכשיר.

## מה נעשה

### 1. הוספת שליחת REFRESH למכשיר בכל שינוי משימה
**קובץ:** `src/hooks/useChores.ts`

אחרי כל פעולה מוצלחת (`addChore`, `approveChore`, `rejectChore`, `deleteChore`) — נשלח `REFRESH_SETTINGS` לכל המכשירים של הילד. נשתמש באותו דפוס שכבר קיים ב-`useChildControls.ts` (`sendRefreshToAllDevices`).

### 2. הוספת Realtime listener ל-TimeRequestsCard
**קובץ:** `src/components/child-dashboard/TimeRequestsCard.tsx`

נוסיף subscription ל-`postgres_changes` על טבלת `time_extension_requests` עם פילטר `child_id`, כדי שההורה יראה בקשות חדשות מיד.

### 3. בדיקה שהכל עובד E2E
נוודא שכשהורה יוצר משימה → נוצר REFRESH_SETTINGS → המכשיר יכול לראות את המשימה ולהשלים אותה → ההורה מקבל עדכון בזמן אמת.

## היקף
שני קבצים, שינויים קטנים. אפס מיגרציות DB — הכל כבר קיים בצד השרת.

