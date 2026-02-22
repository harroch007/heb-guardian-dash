

# הכנת תשתית Backend לניטור אפליקציות ושימוש לילי

## סיכום
הכנת שתי טבלאות חדשות + פונקציות RPC כדי שהאפליקציה באנדרואיד תוכל לשלוח נתונים ברגע שהפיצ'רים יהיו מוכנים.

---

## 1. טבלת `app_alerts` -- התראות על אפליקציות חדשות

| עמודה | סוג | הערות |
|---|---|---|
| id | uuid (PK) | gen_random_uuid() |
| device_id | text | NOT NULL, מפתח זר ל-devices |
| child_id | uuid | יחושב אוטומטית מתוך device_id |
| package_name | text | NOT NULL |
| app_name | text | nullable |
| created_at | timestamptz | now() |

- אינדקס על `(device_id, created_at)`
- אינדקס על `(child_id)`

### RLS:
- **INSERT**: מכשירים יכולים להכניס (anon, `true` -- כמו בטבלאות קיימות כגון alerts)
- **SELECT**: הורים רואים רק של הילדים שלהם (`child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())`)
- **SELECT**: אדמינים רואים הכל

### פונקציית RPC: `create_app_alert`
- פרמטרים: `p_device_id`, `p_package_name`, `p_app_name`
- מחשבת `child_id` מטבלת devices
- מכניסה שורה ל-`app_alerts`
- מחזירה uuid של הרשומה

---

## 2. טבלת `nightly_usage_reports` -- דוחות שימוש לילי

| עמודה | סוג | הערות |
|---|---|---|
| id | uuid (PK) | gen_random_uuid() |
| device_id | text | NOT NULL |
| child_id | uuid | יחושב אוטומטית |
| total_minutes | integer | NOT NULL |
| top_app_package | text | nullable |
| top_app_name | text | nullable |
| top_app_minutes | integer | nullable |
| report_date | date | NOT NULL |
| created_at | timestamptz | now() |

- UNIQUE constraint על `(device_id, report_date)` -- למניעת כפילויות
- אינדקס על `(child_id, report_date)`

### RLS:
- **INSERT**: מכשירים יכולים להכניס
- **SELECT**: הורים רואים רק של הילדים שלהם
- **SELECT**: אדמינים רואים הכל

### פונקציית RPC: `report_nightly_usage`
- פרמטרים: `p_device_id`, `p_total_minutes`, `p_top_app_package`, `p_top_app_name`, `p_top_app_minutes`, `p_report_date`
- מחשבת `child_id` מטבלת devices
- UPSERT (ON CONFLICT על device_id + report_date) -- אם נשלח פעמיים, מעדכן
- מחזירה uuid

---

## 3. Migration SQL (קובץ אחד)

כל השינויים ב-migration אחד:
1. CREATE TABLE `app_alerts`
2. CREATE TABLE `nightly_usage_reports`
3. אינדקסים
4. RLS policies (enable + 3 policies לכל טבלה)
5. פונקציות RPC: `create_app_alert` ו-`report_nightly_usage`

---

## פרטים טכניים

### create_app_alert RPC
```sql
CREATE OR REPLACE FUNCTION public.create_app_alert(
  p_device_id text,
  p_package_name text,
  p_app_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_child_id uuid;
  v_id uuid;
BEGIN
  SELECT child_id INTO v_child_id FROM devices WHERE device_id = p_device_id;
  
  INSERT INTO app_alerts (device_id, child_id, package_name, app_name)
  VALUES (p_device_id, v_child_id, p_package_name, p_app_name)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;
```

### report_nightly_usage RPC
```sql
CREATE OR REPLACE FUNCTION public.report_nightly_usage(
  p_device_id text,
  p_total_minutes integer,
  p_top_app_package text DEFAULT NULL,
  p_top_app_name text DEFAULT NULL,
  p_top_app_minutes integer DEFAULT NULL,
  p_report_date date DEFAULT (now() AT TIME ZONE 'Asia/Jerusalem')::date
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_child_id uuid;
  v_id uuid;
BEGIN
  SELECT child_id INTO v_child_id FROM devices WHERE device_id = p_device_id;
  
  INSERT INTO nightly_usage_reports (device_id, child_id, total_minutes, top_app_package, top_app_name, top_app_minutes, report_date)
  VALUES (p_device_id, v_child_id, p_total_minutes, p_top_app_package, p_top_app_name, p_top_app_minutes, p_report_date)
  ON CONFLICT (device_id, report_date)
  DO UPDATE SET
    total_minutes = EXCLUDED.total_minutes,
    top_app_package = EXCLUDED.top_app_package,
    top_app_name = EXCLUDED.top_app_name,
    top_app_minutes = EXCLUDED.top_app_minutes,
    child_id = COALESCE(EXCLUDED.child_id, nightly_usage_reports.child_id)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;
```

---

## מה לא ישתנה
- אין שינויים בקוד הפרונטאנד כרגע -- זו רק הכנת תשתית
- אין שינויים בטבלאות קיימות
- אין edge functions חדשות -- הפונקציות הן RPC ישירות בדאטאבייס

