

## תוכנית: כפתור "בדוק הרשאות עכשיו" + ניקוי פקודות ישנות

### מה צריך

1. **כפתור בדשבורד Admin** — ב-`AdminCustomerProfile.tsx`, לכל מכשיר של ילד, כפתור "בדוק הרשאות" שמבצע `INSERT` ל-`device_commands` עם `command_type = 'REPORT_HEARTBEAT'`, `status = 'PENDING'`.

2. **ניקוי פקודות ישנות** — מיגרציה SQL ש:
   - יוצרת trigger על `device_commands` שמוחק פקודות `REPORT_HEARTBEAT` ישנות (מעל 5 דקות) לאותו `device_id` בכל `INSERT` חדש
   - או לחלופין, trigger שמוחק פקודות `PENDING` ישנות (מעל שעה) מכל סוג — למנוע הצפה

### שינויים

| # | קובץ / סוג | מה |
|---|---|---|
| 1 | SQL Migration | Trigger `cleanup_old_heartbeat_commands` — ב-`BEFORE INSERT` על `device_commands`, מוחק פקודות `REPORT_HEARTBEAT` ישנות (>5 דק׳) לאותו `device_id` |
| 2 | `AdminCustomerProfile.tsx` | כפתור ליד כל מכשיר — INSERT ל-`device_commands`, עם loading state ו-toast |

### פרטים טכניים

**Migration:**
```sql
CREATE OR REPLACE FUNCTION public.cleanup_old_heartbeat_commands()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.device_commands
  WHERE device_id = NEW.device_id
    AND command_type = 'REPORT_HEARTBEAT'
    AND created_at < now() - interval '5 minutes';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_heartbeat_commands
  BEFORE INSERT ON public.device_commands
  FOR EACH ROW
  WHEN (NEW.command_type = 'REPORT_HEARTBEAT')
  EXECUTE FUNCTION public.cleanup_old_heartbeat_commands();
```

**Frontend (AdminCustomerProfile.tsx):**
- הוספת state `requestingHeartbeat` (Record<string, boolean>) למעקב אחרי מכשירים בטעינה
- פונקציה `handleRequestHeartbeat(deviceId)` שעושה `adminSupabase.from('device_commands').insert(...)` 
- כפתור עם אייקון `RefreshCw` ליד כל מכשיר, בין ה-badges להרשאות

