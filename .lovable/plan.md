

## הוספת נתון "מכשירים שלא שדרגו ל-1.8" בטאב משתמשים (רק פרימיום)

### מה נעשה
נוסיף כרטיס סטטיסטיקה חמישי לרשת הכרטיסים בראש טאב המשתמשים (`AdminUsers.tsx`) שמציג כמה מכשירים של לקוחות **פרימיום** עדיין לא שלחו heartbeat עם `appVersionCode >= 8`.

### איך זה עובד

1. **ב-`AdminUsers.tsx`** — ב-`useEffect` הקיים (או חדש), נריץ שאילתה על `device_heartbeats_raw` דרך `adminSupabase`:
   - נשלוף את כל ה-device_ids של משתמשים בקבוצת פרימיום (מתוך ה-`users` prop + `groups`)
   - לכל device, נבדוק אם קיים heartbeat עם `(device->>'appVersionCode')::int >= 8`
   - נספור כמה מכשירים **אין** להם heartbeat כזה

2. **שאילתה**: נשלוף מ-`device_heartbeats_raw` את כל ה-device_ids הייחודיים שיש להם heartbeat עם גרסה >= 8. ואז נחסיר מרשימת כל מכשירי הפרימיום.

3. **UI** — כרטיס חדש בגריד (נשנה ל-`grid-cols-5` או נשאיר `grid-cols-2 md:grid-cols-5`):
   - אייקון: `Download` או `ArrowUpCircle`
   - כותרת: "לא שדרגו (פרימיום)"
   - מספר בצבע כתום/אדום

### קבצים שישתנו
- `src/pages/admin/AdminUsers.tsx` — הוספת שאילתה + כרטיס סטטיסטיקה

### אין שינוי ב-DB
האדמין כבר יש לו גישת SELECT ל-`device_heartbeats_raw`.

