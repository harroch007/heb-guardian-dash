

## מה צריך

הצגת **דגם המכשיר** (למשל "Xiaomi Redmi 15C") ו**סטטוס הרשאות** (נגישות, Notification Listener) בפרופיל הלקוח באדמין, בתוך הקטע של "ילדים ומנויים".

## מצב נוכחי

- טבלת `devices` **לא מכילה** עמודת `device_model` — אין מידע על סוג המכשיר
- אין התראות `PERMISSION_MISSING` בפועל (הפונקציה `create_permission_alert` קיימת אבל האפליקציה באנדרואיד לא קוראת לה עדיין, או שפשוט אין עדיין מכשירים שדיווחו)
- הפרופיל באדמין מציג רק `device_id` מקוצר + סוללה

## תוכנית

### 1. מיגרציה — הוספת עמודות לטבלת `devices`
```sql
ALTER TABLE public.devices ADD COLUMN device_model TEXT;
ALTER TABLE public.devices ADD COLUMN device_manufacturer TEXT;
```

עדכון פונקציות `update_device_status` ו-`connect_child_device` / `pair_device` כך שיוכלו לקבל ולשמור את דגם המכשיר (האנדרואיד ישלח את זה בעתיד).

### 2. עדכון `AdminCustomerProfile.tsx` — הצגת מידע מורחב למכשיר

בקטע "ילדים ומנויים", מתחת לכל ילד, במקום להציג רק `device_id` מקוצר:

- **דגם מכשיר**: `device_manufacturer + device_model` (למשל "Xiaomi Redmi 15C"), או "לא ידוע" אם חסר
- **סטטוס הרשאות**: שאילתה על טבלת `alerts` עם `category = 'PERMISSION_MISSING'` ב-24 שעות האחרונות לכל `child_id`
  - אם קיימת התראה פתוחה → באדג' כתום "⚠️ הרשאות חסרות" + tooltip עם הפרטים
  - אם אין → באדג' ירוק "✅ הרשאות תקינות"
- **זיהוי אוטומטי**: בדיקה אם למכשיר יש `app_usage` אבל אין `alerts` (למעט PERMISSION_MISSING) → סימון "חשד להרשאות חסרות"

### 3. עדכון ה-fetch בפרופיל

ב-`fetchCustomerData`, הרחבת השאילתה של devices:
```ts
.select("device_id, child_id, last_seen, battery_level, device_model, device_manufacturer")
```

והוספת שאילתה נוספת:
```ts
// בדיקת התראות PERMISSION_MISSING פתוחות
const { data: permAlerts } = await adminSupabase
  .from("alerts")
  .select("child_id, parent_message, created_at")
  .eq("category", "PERMISSION_MISSING")
  .is("acknowledged_at", null)
  .in("child_id", childIds);
```

### 4. עדכון ממשקים

- `ChildDetail.devices` → הוספת `device_model` ו-`device_manufacturer`
- הוספת שדה `permissionAlerts` ל-`ChildDetail`

### פרטים טכניים

- שינוי קובץ אחד: `AdminCustomerProfile.tsx` (UI + fetch)
- מיגרציה אחת: הוספת `device_model`, `device_manufacturer` ל-`devices`
- עדכון `update_device_status` לקבל פרמטרים חדשים (אופציונליים)
- ה-types.ts יתעדכן אוטומטית אחרי המיגרציה

