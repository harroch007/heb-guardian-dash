

# תוכנית: שער אימות אחיד לכל הפונקציות שמדברות עם האנדרואיד

## המצב היום — שתי שפות שונות

יש **5 RPCs שכבר מוגנים** עם ה-2-tier gate (JWT + Legacy fallback):
1. `update_device_status` ✅
2. `report_device_heartbeat` ✅  
3. `report_installed_apps` ✅
4. `create_alert` ✅
5. `get_device_settings` ✅

ויש **2 RPCs שנשארו בלי שום הגנה** — הם פשוט פתוחים לכולם:
6. `complete_chore` — ❌ בלי gate בכלל
7. `request_extra_time` — ❌ בלי gate בכלל

הבעיה: כל פעם שמוסיפים פיצ'ר חדש שדורש תקשורת Android↔Supabase, צריך לזכור להוסיף את אותו קוד אימות. זה מה שיצר את הבאג עכשיו.

## הפתרון: פונקציית עזר אחת לכולם

במקום לשכפל את אותם 15 שורות קוד בכל RPC, ניצור **פונקציה אחת** שכל ה-RPCs יקראו לה:

```sql
public.authorize_device_call(p_device_id text) RETURNS uuid
```

הפונקציה הזו:
1. בודקת JWT — אם יש `role='device'` ו-`device_id` תואם → מחזירה את ה-`child_id`
2. Legacy fallback — אם אין JWT, בודקת שה-`device_id` מחובר לילד בטבלת `devices` → מחזירה את ה-`child_id`
3. אם שניהם נכשלים → זורקת `UNAUTHORIZED`

כל RPC שצריך לדבר עם האנדרואיד פשוט יקרא:
```sql
v_child_id := public.authorize_device_call(p_device_id);
```

שורה אחת במקום 15.

## מה ישתנה

### שלב 1 — יצירת פונקציית העזר
```sql
CREATE FUNCTION public.authorize_device_call(p_device_id text) RETURNS uuid
```

### שלב 2 — עדכון complete_chore
- הוספת פרמטר `p_device_id text DEFAULT NULL`
- קריאה ל-`authorize_device_call` (אם אין JWT מאומת)
- וידוא שה-chore שייך ל-child_id שחזר

### שלב 3 — עדכון request_extra_time
- הוספת פרמטר `p_device_id text DEFAULT NULL`
- קריאה ל-`authorize_device_call` (אם אין JWT מאומת)
- וידוא שה-child_id תואם

### שלב 4 — רפקטור 5 ה-RPCs הקיימים (אופציונלי אבל מומלץ)
להחליף את 15 השורות המשוכפלות ב-5 הפונקציות הקיימות בקריאה לפונקציית העזר החדשה. אותו ביטחון, פחות קוד, אפס כפילויות.

## מה זה נותן לנו

```text
לפני:                              אחרי:
┌──────────────────────┐           ┌──────────────────────┐
│ update_device_status │           │ update_device_status │
│  [15 שורות gate]     │           │  authorize_device()  │
├──────────────────────┤           ├──────────────────────┤
│ report_heartbeat     │           │ report_heartbeat     │
│  [15 שורות gate]     │           │  authorize_device()  │
├──────────────────────┤           ├──────────────────────┤
│ complete_chore       │           │ complete_chore       │
│  [אין gate!!! ❌]    │           │  authorize_device()  │
├──────────────────────┤           ├──────────────────────┤
│ request_extra_time   │           │ request_extra_time   │
│  [אין gate!!! ❌]    │           │  authorize_device()  │
└──────────────────────┘           └──────────────────────┘
                                    כולם משתמשים באותה
                                    פונקציה — שפה אחת
```

## תאימות לאחור
- הפרמטר `p_device_id` הוא `DEFAULT NULL` בכל מקום — קריאות מצד ההורה (שמשתמש ב-JWT רגיל) לא יישברו
- 5 ה-RPCs הקיימים ימשיכו לעבוד בדיוק כמו היום
- האנדרואיד כבר שולח `p_device_id` — אז הוא מוכן

## סיכום
מיגרציה אחת שיוצרת את `authorize_device_call` ומעדכנת את `complete_chore` ו-`request_extra_time`. אופציונלית — רפקטור ל-5 הקיימים כדי לנקות כפילויות.

