

## תיקון: חילוץ אחוז סוללה מה-heartbeat

### הבעיה
הטריגר `on_heartbeat_insert` מעדכן metadata (model, manufacturer) מתוך ה-heartbeat אבל לא מחלץ את `batteryLevel` מתוך ה-device JSONB. לכן `devices.battery_level` נשאר תקוע על 28% למרות שה-heartbeat האחרון מדווח 100%.

### הפתרון
עדכון הטריגר `on_heartbeat_insert` כך שיחלץ גם `batteryLevel` מתוך `NEW.device` ויעדכן את `devices.battery_level`.

**קובץ: migration חדש**

בתוך הבלוק שמעדכן את `devices` (שכבר עושה `SET device_model = ..., device_manufacturer = ...`), להוסיף:

```sql
battery_level = COALESCE((NEW.device->>'batteryLevel')::int, devices.battery_level)
```

זה יעדכן את הסוללה רק אם השדה קיים ב-heartbeat, אחרת ישאיר את הערך הקיים.

שינוי של שורה אחת בטריגר קיים.

