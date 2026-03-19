## תכנית ביצוע — 3 משימות דחופות

---

### משימה 1: Request More / בקש עוד זמן

**Supabase (Migration):**

1. טבלה חדשה `time_extension_requests`:
  - `id uuid PK default gen_random_uuid()`
  - `child_id uuid FK → children NOT NULL`
  - `parent_id uuid FK → parents NOT NULL` (מחושב מ-child)
  - `reason text`
  - `requested_minutes int DEFAULT 15`
  - `status text DEFAULT 'pending'` — check: `pending`, `approved`, `rejected`
  - `created_at timestamptz DEFAULT now()`
  - `responded_at timestamptz`
  - RLS: הורה SELECT/UPDATE על ילדיו, anon INSERT דרך RPC בלבד
2. RPC `request_extra_time(p_child_id uuid, p_reason text)`:
  - מוצא `parent_id` מ-`children`
  - INSERT ל-`time_extension_requests` עם `status='pending'`
  - `SECURITY DEFINER` — ללא צורך באימות (הילד לא מחובר כ-user)
  - להחזיר לי ביישום עצמו את ה-signature המדויק, ה-return type המדויק, ו-query בדיקה תואם אמיתי
3. RPC `respond_time_request(p_request_id uuid, p_approved boolean, p_minutes int DEFAULT 15)`:
  - מוודא שה-request שייך לילד של `auth.uid()`
  - אם `approved`: להשתמש במנגנון הקיים במערכת להענקת דקות לילד, ובמידה וזה אכן המסלול הקיים — `INSERT` ל-`bonus_time_grants` + שליחת `REFRESH_SETTINGS`
  - מעדכן `status` ו-`responded_at`

**UI (Lovable):**

4. קומפוננטה חדשה `TimeRequestsCard.tsx` ב-`src/components/child-dashboard/`:
  - מושך `pending requests` מ-`time_extension_requests` לפי `child_id`
  - עובד לפי `childId` מפורש שמגיע מה-`ChildDashboard` של הילד הפעיל
  - מציג `reason`, `created_at`
  - כפתורי approve (ירוק) / reject (אדום)
  - קורא ל-RPC `respond_time_request`
  - אחרי action — `refetch`
5. שילוב ב-`ChildDashboard.tsx`:
  - מוצג מעל `ScreenTimeSection` (אם יש `pending requests`)

**קבצים שייגעו:**

- Migration חדשה (טבלה + 2 RPCs + RLS)
- `src/components/child-dashboard/TimeRequestsCard.tsx` (חדש)
- `src/components/child-dashboard/index.ts` (export)
- `src/pages/ChildDashboard.tsx` (שילוב)

---

### משימה 2: Days Mapping — יישור ל-1–7

**Migration (Data):**

```
UPDATE schedule_windows sw
SET days_of_week = (
  SELECT array_agg(d + 1)
  FROM unnest(sw.days_of_week) AS d
)
WHERE sw.days_of_week IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM unnest(sw.days_of_week) AS d
    WHERE d BETWEEN 0 AND 6
  )
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(sw.days_of_week) AS d
    WHERE d = 7
  );
```

**קוד — שינוי DAYS array:**

`ScheduleEditModal.tsx` — `DAYS values`: `1,2,3,4,5,6,7` במקום `0,1,2,3,4,5,6`

Defaults:

- bedtime: `[1,2,3,4,5,6,7]` (כל יום)
- school: `[1,2,3,4,5]` (א׳–ה׳)

`SchedulesSection.tsx` — `DAY_LABELS` index shift:

```
const DAY_LABELS: Record<number, string> = {1:"א׳", 2:"ב׳", 3:"ג׳", 4:"ד׳", 5:"ה׳", 6:"ו׳", 7:"ש׳"};
```

`renderDays` — עדכון לעבודה עם 1-7.

**קבצים שייגעו:**

- Migration חדשה (UPDATE data)
- `src/components/child-dashboard/ScheduleEditModal.tsx`
- `src/components/child-dashboard/SchedulesSection.tsx`

**אין שינוי ב-**`useChildControls.ts` — הוא פשוט מעביר `as-is`.  
  
**אין שינוי ב-**`get_device_settings` — מעביר `as-is`.

---

### משימה 3: Streak — חישוב ושמירה ב-Supabase

**Migration:**

1. הוספת שדות ל-`reward_bank`:
  - `current_streak int DEFAULT 0`
  - `last_streak_date date`
2. עדכון RPC `approve_chore` — הוספת לוגיקת `streak`:
  ```
  v_today := (now() AT TIME ZONE 'Asia/Jerusalem')::date;
  IF last_streak_date = v_today → no change
  ELSIF last_streak_date = v_today - 1 → streak + 1
  ELSE → streak = 1
  ```
3. חשיפה ב-`get_device_settings`:
  - הוספת `current_streak` ו-`balance_minutes` מ-`reward_bank` לפלט

**קבצים שייגעו:**

- Migration חדשה (ALTER TABLE + replace `approve_chore` + update `get_device_settings`)

**אין שינוי בקוד Lovable** — המשימה הזו היא backend בלבד. האנדרואיד ימשוך דרך `get_device_settings`.

---

### סיכום קבצים


| קובץ                                                   | שינוי                                                                                        |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Migration 1                                            | טבלה `time_extension_requests` + RPC `request_extra_time` + RPC `respond_time_request` + RLS |
| Migration 2                                            | UPDATE `schedule_windows` data 0→1...6→7 רק לרשומות שעדיין בפורמט הישן                       |
| Migration 3                                            | ALTER `reward_bank` + replace `approve_chore` + update `get_device_settings`                 |
| `src/components/child-dashboard/TimeRequestsCard.tsx`  | חדש                                                                                          |
| `src/components/child-dashboard/index.ts`              | export חדש                                                                                   |
| `src/pages/ChildDashboard.tsx`                         | שילוב `TimeRequestsCard`                                                                     |
| `src/components/child-dashboard/ScheduleEditModal.tsx` | `DAYS` 1-7                                                                                   |
| `src/components/child-dashboard/SchedulesSection.tsx`  | `DAY_LABELS` 1-7                                                                             |
