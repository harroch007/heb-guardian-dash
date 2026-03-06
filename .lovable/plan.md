

## תוכנית עבודה: עיבוד Heartbeat והצגת הרשאות אמיתיות ב-Admin

### מה כבר קיים
- טבלת `device_heartbeats_raw` עם עמודות: `child_id`, `device_id`, `device` (JSONB), `permissions` (JSONB), `reported_at`
- RPC `report_device_heartbeat` שמכניס שורות לטבלה
- RPC `create_permission_alert` שיוצר התראת הרשאות (אבל כותב לעמודות ישנות `raw_message`/`parent_message` שלא קיימות בסכמה הנוכחית — צריך תיקון)
- `AdminCustomerProfile` מציג הרשאות בהיוריסטיקה (app_usage vs alerts) ודגם מכשיר מטבלת `devices`
- `analyze-alert` כבר שולח push notification להורה כשהוא מעבד התראה
- `send-push-notification` edge function קיים ועובד

### מה חסר / צריך לבנות

---

### משימה 1: DB Trigger לזיהוי שינוי הרשאות

**מיגרציה SQL** — יצירת trigger function על `device_heartbeats_raw`:

- ב-`AFTER INSERT` על `device_heartbeats_raw`, הפונקציה:
  1. שולפת את השורה הקודמת לאותו `device_id` (לפי `reported_at DESC`, `id < NEW.id`)
  2. אם אין שורה קודמת — דילוג (heartbeat ראשון)
  3. משווה כל שדה ב-`permissions` JSONB: accessibility, notificationListener, usageStats, location, batteryOptimization
  4. לכל שדה שהשתנה מ-`true` ל-`false`:
     - שולפת `child_name` מ-`children` דרך `devices`
     - מכניסה שורה ל-`alerts` עם: `category='system'`, `sender='SYSTEM'`, `ai_verdict='notify'`, `is_processed=true`, `content` עם הודעה בעברית
- בנוסף, מעדכנת `devices.device_model` ו-`devices.device_manufacturer` מ-`NEW.device`

### משימה 2: Edge Function לשליחת Push על התראת הרשאות

**מיגרציה SQL** — trigger נוסף (או חלק מאותו trigger):
- כשנוצרת התראת `category='system'` עם `sender='SYSTEM'`, לקרוא ל-`send-push-notification` דרך `net.http_post` (כמו ב-`trigger_analyze_alert`)
- **או** לחלופין — להוסיף את הלוגיקה ישירות בתוך ה-trigger function שיוצר את ההתראה, באמצעות `net.http_post` ל-`send-push-notification`

### משימה 3: עדכון AdminCustomerProfile — הרשאות אמיתיות

**קובץ: `src/pages/admin/AdminCustomerProfile.tsx`**

- ב-`fetchCustomerData`: שליפת ה-heartbeat האחרון לכל `device_id` מ-`device_heartbeats_raw` (סידור לפי `reported_at DESC`, `limit 1` לכל מכשיר)
- הוספת `latestHeartbeat` ל-interface `ChildDetail.devices[]`
- בתצוגה — אם יש heartbeat:
  - הצגת `device.manufacturer + device.model` מתוך ה-JSONB (במקום מ-`devices` table)
  - הצגת `device.appVersionName` כ-badge
  - הצגת כל הרשאה כ-badge ירוק/אדום: Accessibility, NotificationListener, UsageStats, Location, BatteryOptimization
- אם אין heartbeat — fallback לדגם מטבלת `devices` או "דגם לא דווח", ולוגיקת ההיוריסטיקה הנוכחית

### משימה 4: תיקון `create_permission_alert` RPC

- ה-RPC הקיים כותב ל-`raw_message` ו-`parent_message` — עמודות שלא קיימות בסכמה
- צריך לעדכן אותו לכתוב ל-`content` ול-`parent_message` (שכן קיים) או להסיר אותו לטובת הלוגיקה בתוך ה-trigger

---

### סדר ביצוע

| # | משימה | סוג |
|---|--------|-----|
| 1 | מיגרציה: Trigger function `on_heartbeat_insert` — השוואת הרשאות, יצירת system alert, עדכון device metadata | SQL Migration |
| 2 | מיגרציה: בתוך אותו trigger — `net.http_post` ל-`send-push-notification` לשליחת push להורה | SQL Migration |
| 3 | עדכון `AdminCustomerProfile.tsx` — שליפת heartbeat אחרון, הצגת הרשאות כ-badges, הצגת דגם+גרסה | Frontend |
| 4 | הסרת/עדכון `create_permission_alert` RPC (כבר לא נחוץ — ה-trigger עושה את העבודה) | SQL Migration |

