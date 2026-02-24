

# תיקון באג כפילויות ב-`parent_alerts_effective` והמדד "התראות נשלחו"

## שורש הבעיה

ה-view `parent_alerts_effective` מבצע `LEFT JOIN settings s ON s.child_id = a.child_id AND s.device_id IS NULL`. 
בפועל, לילד `6233e88a` קיימות **6 שורות settings** עם `device_id IS NULL` (כפילויות). 
כל התראה מוכפלת ×6, ולכן במקום 6 התראות אפקטיביות מופיעות 36.

```text
alerts (12 total, 6 match notify criteria)
  × settings (6 duplicate rows for same child)
  = 36 rows in parent_alerts_effective
```

## תוכנית תיקון

### שלב 1: ניקוי כפילויות בטבלת settings (Data fix)
מחיקת 5 מתוך 6 שורות settings כפולות, השארת רק השורה האחרונה (עם `alert_threshold = 65`).

```sql
DELETE FROM settings 
WHERE child_id = '6233e88a-0212-4682-a350-442681e95a5f' 
  AND device_id IS NULL 
  AND id != 'dc974a5d-e8c7-410d-8831-941e6f71fef2';
```

### שלב 2: תיקון ה-view למניעת כפילויות עתידיות (Schema migration)
החלפת ה-`LEFT JOIN settings` ב-lateral join שמביא שורה אחת בלבד:

```sql
CREATE OR REPLACE VIEW parent_alerts_effective AS
SELECT 
  a.*,  -- (all existing columns)
  COALESCE(d.first_seen_at, d.created_at) AS warmup_start,
  (d.device_id IS NOT NULL AND now() < COALESCE(d.first_seen_at, d.created_at) + interval '72 hours') AS is_in_warmup,
  COALESCE(
    s.alert_threshold,
    CASE WHEN d.device_id IS NOT NULL 
         AND now() < COALESCE(d.first_seen_at, d.created_at) + interval '72 hours' 
         THEN 80 ELSE 60 END
  ) AS effective_threshold
FROM alerts a
LEFT JOIN devices d ON d.device_id = a.device_id
LEFT JOIN LATERAL (
  SELECT s1.alert_threshold
  FROM settings s1
  WHERE s1.child_id = a.child_id AND s1.device_id IS NULL
  ORDER BY s1.updated_at DESC
  LIMIT 1
) s ON true
WHERE (a.alert_type = 'warning' AND a.ai_verdict = 'notify' 
       AND a.ai_risk_score IS NOT NULL 
       AND a.ai_risk_score >= COALESCE(s.alert_threshold, ...))
   OR (a.alert_type = 'positive' AND a.is_processed = true);
```

### שלב 3: הקוד בדשבורד (כבר מתוקן)
השינוי שביצענו — `notify_effective_today` במקום `alerts_sent` — **נכון לוגית**. ברגע שה-view יתוקן, המספר יציג את הערך האמיתי (6 במקום 36).

### שלב 4: מניעה — UNIQUE constraint
הוספת constraint ייחודי למניעת כפילויות עתידיות:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_settings_child_no_device
ON settings (child_id) WHERE device_id IS NULL AND parent_id IS NOT NULL;
```

## סיכום השינויים

| פעולה | סוג | קובץ/מקום |
|-------|------|-----------|
| מחיקת 5 שורות settings כפולות | Data fix | DB |
| תיקון view `parent_alerts_effective` עם LATERAL JOIN | Migration | DB |
| הוספת UNIQUE INDEX | Migration | DB |
| **אין שינוי בקוד** — `notify_effective_today` נשאר | — | Dashboard.tsx |

## פרטים טכניים

- ה-view `parent_home_snapshot` כבר מסנן `alert_type = 'warning'` ב-CTE של `notify_effective`, אז אחרי התיקון המספר יהיה תקין
- צריך לוודא שה-view החדש שומר על אותה חתימת עמודות כדי לא לשבור קוד קיים
- ה-`parent_daily_report` function משתמשת בגישה דומה אבל עם CTE נפרד, אז היא לא מושפעת מהבאג

