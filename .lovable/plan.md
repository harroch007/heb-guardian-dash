

# עדכון פונקציות ניקוי נתונים לטבלאות החדשות

## הבעיה
הפונקציות `delete_child_data` ו-`cleanup_old_data` לא כוללות את הטבלאות החדשות שיצרנו (`app_alerts`, `nightly_usage_reports`). כשהורה מוחק ילד או כשמנקים נתונים ישנים, הנתונים מהטבלאות החדשות לא יימחקו.

## מה ישתנה

### 1. `delete_child_data` -- מחיקת נתוני ילד
נוסיף מחיקה של:
- `app_alerts WHERE child_id = p_child_id`
- `nightly_usage_reports WHERE child_id = p_child_id`

### 2. `cleanup_old_data` -- ניקוי נתונים ישנים (30 יום)
נוסיף מחיקה של:
- `app_alerts WHERE created_at < threshold`
- `nightly_usage_reports WHERE created_at < threshold`

## פרטים טכניים

Migration אחד עם שני `CREATE OR REPLACE FUNCTION` שמעדכנים את הפונקציות הקיימות:

- `delete_child_data`: יוסיף `DELETE FROM app_alerts WHERE child_id = p_child_id` ו-`DELETE FROM nightly_usage_reports WHERE child_id = p_child_id` לפני מחיקת ה-devices
- `cleanup_old_data`: יוסיף מחיקה של שתי הטבלאות החדשות לפי `created_at < threshold`
- התוצאות (JSONB) יכללו את הספירות החדשות

אין שינויים בפרונטאנד.

