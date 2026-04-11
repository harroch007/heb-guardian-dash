

# ניתוח זרימת הנתונים: הורה → Supabase → אנדרואיד

## הזרימה המתועדת בקוד (שלב אחרי שלב)

```text
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│  הורה       │     │  Supabase DB     │     │  Realtime /     │     │  אנדרואיד    │
│  (Dashboard) │────▶│  schedule_windows│────▶│  device_commands│────▶│  (Agent)     │
└─────────────┘     └──────────────────┘     └─────────────────┘     └──────────────┘
     שלב 1              שלב 2                    שלב 3                  שלב 4
```

### שלב 1 — הורה לוחץ "שעת שינה"
הקוד ב-`useChildControls.ts` → `createSchedule()`:
- מכניס שורה ל-`schedule_windows` (start_time=20:00, end_time=07:00, is_active=true) ✅
- קורא ל-`sendRefreshToAllDevices()` שמכניס פקודת `REFRESH_SETTINGS` ל-`device_commands` ✅

### שלב 2 — הפקודה נכנסת ל-DB
הפקודה נכנסת עם `status: "PENDING"` ל-`device_commands`.
**אישור מה-DB:** REFRESH_SETTINGS האחרון (17:52 UTC) → סטטוס **COMPLETED** — כלומר האנדרואיד **כן קיבל וביצע** את הפקודה.

### שלב 3 — איך האנדרואיד מקבל את הפקודה
שני מנגנונים אפשריים:
1. **Realtime subscription** — `device_commands` כן נמצא ב-`supabase_realtime` publication ✅
2. **Polling** — האנדרואיד סורק מדי 30 שניות פקודות PENDING

**ממצא חשוב:** לפי תיעוד הפרויקט, לאנדרואיד **אין Realtime subscription פעיל** — הוא מסתמך על polling בלבד.

### שלב 4 — מה האנדרואיד עושה כשהוא מקבל REFRESH_SETTINGS
לפי החוזה (`android-agent-contract`):
1. האנדרואיד קורא ל-RPC `get_device_settings(p_device_id)`
2. ה-RPC מחזיר JSON שכולל:
   - `schedules` — מערך של לוחות זמנים פעילים (כולל שעת שינה)
   - `effective_screen_time_limit_minutes`
   - `app_policies`
   - ועוד...

## מה ה-RPC מחזיר עבור schedules

```json
{
  "id": "b48b5a7b-...",
  "name": "שעת שינה",
  "schedule_type": "bedtime",
  "days_of_week": [1,2,3,4,5,6,7],
  "start_time": "20:00:00",
  "end_time": "07:00:00"
}
```

**שים לב:** אין שדה `timezone` ואין שדה `mode` — האנדרואיד מקבל `start_time` ו-`end_time` כ-strings פשוטים ללא הקשר timezone.

## הממצאים

### ✅ מה שעובד
1. שעת השינה **נשמרה בהצלחה** ב-DB
2. פקודת REFRESH_SETTINGS **נוצרה ונשלחה**
3. האנדרואיד **קיבל את הפקודה** (סטטוס COMPLETED)
4. ה-RLS תוקן ועובד — האנדרואיד יכול לקרוא פקודות

### ❌ מה לא עובד
**הבעיה היא בצד האנדרואיד** — הוא מקבל את ההגדרות אבל לא אוכף את שעת השינה.

הסיבות האפשריות (בצד אנדרואיד, שאין לנו גישה אליו):
1. האנדרואיד לא מפרש את `schedule_type: "bedtime"` נכון
2. האנדרואיד מפרש את `start_time: "20:00:00"` ב-UTC במקום בשעון ישראל
3. הלוגיקה של אכיפת bedtime לא מיושמת באנדרואיד

## מה שאנחנו **יכולים** לעשות מצד Supabase

### שינוי מומלץ: הוספת timezone ו-mode ל-schedules ב-`get_device_settings`

כרגע ה-RPC מחזיר:
```sql
jsonb_build_object(
  'id', sw.id,
  'name', sw.name,
  'schedule_type', sw.schedule_type,
  'days_of_week', sw.days_of_week,
  'start_time', sw.start_time,
  'end_time', sw.end_time
)
```

צריך להוסיף:
```sql
jsonb_build_object(
  'id', sw.id,
  'name', sw.name,
  'schedule_type', sw.schedule_type,
  'days_of_week', sw.days_of_week,
  'start_time', sw.start_time,
  'end_time', sw.end_time,
  'timezone', 'Asia/Jerusalem',
  'mode', sw.mode,
  'is_active', sw.is_active
)
```

זה יתן לאנדרואיד את כל המידע שהוא צריך כדי לאכוף נכון.

## מה להגיד למפתח האנדרואיד

הודעה למפתח:

> **בדיקה נדרשת בצד אנדרואיד:**
>
> 1. פקודת REFRESH_SETTINGS מגיעה בהצלחה (COMPLETED) — אימות: טבלת device_commands
> 2. ה-RPC `get_device_settings` מחזיר schedule עם `schedule_type: "bedtime"`, `start_time: "20:00:00"`, `end_time: "07:00:00"`
> 3. **השאלה:** האם SyncWorker קורא ל-`get_device_settings` אחרי שהוא מקבל REFRESH_SETTINGS? ואם כן, האם הוא מפעיל לוגיקת אכיפה על schedules מסוג bedtime?
> 4. **Timezone:** ה-start_time/end_time הם בשעון ישראל (Asia/Jerusalem). אנחנו נוסיף שדה `timezone` ל-JSON — תוודא שאתה קורא אותו.
> 5. **Polling fallback:** אם אין Realtime subscription, תוודא שה-polling רץ כל 30 שניות ומחפש פקודות PENDING ב-`device_commands`.

## סיכום פעולות

| # | פעולה | צד |
|---|---|---|
| 1 | הוספת `timezone`, `mode`, `is_active` ל-schedules ב-`get_device_settings` | Supabase (מיגרציה) |
| 2 | בדיקת לוגיקת אכיפת bedtime | אנדרואיד (מפתח) |

המיגרציה היא שינוי אחד קטן ב-RPC — ללא סיכון, רק מוסיף שדות ל-JSON.

