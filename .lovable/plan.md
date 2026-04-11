

# עדכון RPCs לתמיכה ב-Legacy Fallback עם `p_device_id`

## הבעיה
האנדרואיד עובד במצב anon (Legacy Fallback) וצריך להעביר `p_device_id` כדי להוכיח שהוא מכשיר מורשה. שני RPCs לא מקבלים את הפרמטר הזה ולכן דוחים את הקריאה.

## מה צריך לשנות

### 1. `complete_chore` (שתי גרסאות קיימות)
- גרסה 1: `(p_chore_id uuid)` 
- גרסה 2: `(p_chore_id uuid, p_photo_base64 text)`

**פעולה:** מחיקת שתי הגרסאות והחלפה בגרסה אחת מאוחדת:
```
complete_chore(p_chore_id uuid, p_photo_base64 text DEFAULT NULL, p_device_id text DEFAULT NULL)
```

לוגיקת אימות:
1. בדיקת JWT — אם יש `auth.uid()` ומשתמש מאומת, ממשיך (הורה/אדמין)
2. אם אין JWT — בדיקה שה-`p_device_id` שייך לילד שה-chore שלו (דרך `devices` → `children`)
3. אם שניהם חסרים — דחייה עם `UNAUTHORIZED`

### 2. `request_extra_time`
חתימה נוכחית: `(p_child_id uuid, p_reason text)`

**פעולה:** החלפה בגרסה עם device_id:
```
request_extra_time(p_child_id uuid, p_reason text, p_device_id text DEFAULT NULL)
```

לוגיקת אימות זהה:
1. JWT check — אם מאומת, ממשיך
2. Legacy fallback — `p_device_id` שייך ל-`p_child_id` דרך טבלת `devices`
3. אחרת — `UNAUTHORIZED`

## פרטים טכניים

- שתי הפונקציות יישארו `SECURITY DEFINER` כדי לעקוף RLS
- הפרמטר `p_device_id` הוא `DEFAULT NULL` כדי לא לשבור קריאות קיימות מצד ההורה
- בדיקת device ownership: `SELECT 1 FROM devices WHERE device_id = p_device_id AND child_id = v_child_id`
- `GRANT EXECUTE` ל-`anon` ו-`authenticated`

## סיכום
מיגרציה אחת עם DROP + CREATE לשלוש הפונקציות (2 complete_chore + 1 request_extra_time). אפס שינויים בצד הקליינט של ההורה.

