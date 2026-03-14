

## בעיה: מחיקת משימה לא מתעדכנת בצד הילד

הבעיה: כשהורה מוחק משימה, השורה נמחקת מה-DB, אבל הסוכן באנדרואיד לא מקבל עדכון ומציג את המשימה מהקאש המקומי.

### פתרון: טריגר שולח פקודת רענון למכשיר

מכיוון שאי אפשר לשנות את קוד האנדרואיד, ניצור **database trigger** שברגע שמשימה נמחקת מטבלת `chores`, מוסיף שורה לטבלת `device_commands` עם `command_type = 'REFRESH_CHORES'` למכשיר של הילד המתאים.

הסוכן כבר מאזין ל-`device_commands` בזמן אמת — אז הוא יקבל את הפקודה ויטען מחדש את רשימת המשימות.

### שינוי יחיד — Migration

```sql
CREATE OR REPLACE FUNCTION notify_child_chore_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO device_commands (device_id, command_type, status)
  SELECT d.device_id, 'REFRESH_CHORES', 'PENDING'
  FROM devices d
  WHERE d.child_id = OLD.child_id;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_chore_deleted_notify
  AFTER DELETE ON chores
  FOR EACH ROW
  EXECUTE FUNCTION notify_child_chore_deleted();
```

- **כל מחיקת משימה** → פקודת `REFRESH_CHORES` נשלחת למכשיר הילד
- הסוכן מקבל את הפקודה דרך ה-realtime subscription שלו ל-`device_commands` ומרענן את רשימת המשימות
- אין שינוי בקוד הווב — רק migration בבסיס הנתונים

### תלות
הסוכן צריך לטפל בפקודת `REFRESH_CHORES` — אם הוא עדיין לא מכיר אותה, צריך לוודא שהוא מטפל בה (או שהוא כבר מטפל ב-`REFRESH_SETTINGS` שכולל גם chores).

