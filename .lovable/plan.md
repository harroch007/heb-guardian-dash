

# תוכנית: שמירת תובנות AI יומיות בטבלה מחזורית

## סקירת הבעיה

כרגע, בכל כניסה לדוח היומי:
1. נשלחת קריאה ל-OpenAI (עלות כספית גבוהה)
2. הטקסט משתנה בכל רענון (temperature: 0.7)
3. ה-cache ב-sessionStorage נמחק בסגירת הטאב

## הפתרון: טבלה מחזורית לפי יום בשבוע

### עיקרון הפעולה

יצירת טבלה `child_daily_insights` עם partition לוגי לפי `day_of_week` (0-6):
- כל ילד יכול להחזיק עד 7 רשומות (אחת לכל יום בשבוע)
- כשמגיע יום חדש, הרשומה מתעדכנת אוטומטית (UPSERT)
- אין צורך ב-cron, retention logic או מחיקת נתונים ישנים

```text
+----------+-----+------------+-----------+---------------------+
| child_id | dow | date       | insights  | created_at          |
+----------+-----+------------+-----------+---------------------+
| abc123   |  0  | 2026-01-26 | {...}     | 2026-01-26 08:00:00 |
| abc123   |  1  | 2026-01-27 | {...}     | 2026-01-27 08:00:00 |
| abc123   |  2  | 2026-01-28 | {...}     | 2026-01-28 08:00:00 |
| ...      | ... | ...        | ...       | ...                 |
+----------+-----+------------+-----------+---------------------+
```

## שינויים טכניים

### 1. טבלת Supabase חדשה: `child_daily_insights`

```sql
CREATE TABLE public.child_daily_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  insight_date date NOT NULL,
  headline text NOT NULL,
  insights text[] NOT NULL,
  suggested_action text,
  severity_band text NOT NULL CHECK (severity_band IN ('calm', 'watch', 'intense')),
  data_quality text NOT NULL CHECK (data_quality IN ('good', 'partial', 'insufficient')),
  created_at timestamptz DEFAULT now(),
  
  UNIQUE (child_id, day_of_week)
);

-- RLS: הורים יכולים לראות רק את התובנות של הילדים שלהם
ALTER TABLE child_daily_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view their children insights"
  ON child_daily_insights FOR SELECT
  USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));
```

### 2. עדכון Edge Function: `generate-daily-insights`

לוגיקה חדשה:
```text
1. קבל child_id + date
2. חשב day_of_week מהתאריך
3. בדוק האם קיימת רשומה עם אותו child_id + day_of_week + insight_date
   - אם כן: החזר את הרשומה הקיימת (ללא קריאה ל-OpenAI)
   - אם לא: קרא ל-OpenAI, שמור בטבלה (UPSERT), והחזר
```

### 3. עדכון Frontend: `DailyReport.tsx`

- הסרת לוגיקת ה-sessionStorage cache
- פשוט לקרוא ל-Edge Function שמטפל בכל הלוגיקה

### 4. עדכון Frontend: `Dashboard.tsx`

- עדכון ה-localStorage cache לעבוד יחד עם הלוגיקה החדשה
- ללא שינוי מהותי - ה-Edge Function מחזיר cached data כשזמין

## יתרונות הפתרון

| לפני | אחרי |
|------|------|
| קריאה ל-OpenAI בכל רענון | קריאה אחת ליום לילד |
| טקסט משתנה באותו יום | טקסט עקבי לכל התאריך |
| cache נמחק בסגירת טאב | נתונים שמורים בDB |
| אין שיתוף בין מכשירים | כל המכשירים רואים אותו דבר |
| עלות AI גבוהה | הפחתה דרמטית בעלות |

## זרימת נתונים

```text
[Frontend] -> [Edge Function: generate-daily-insights]
                    |
                    v
            [Check DB for existing insight]
                    |
        +-----------+-----------+
        |                       |
   [Found & same date]    [Not found OR different date]
        |                       |
        v                       v
   [Return cached]        [Call OpenAI]
                                |
                                v
                          [UPSERT to DB]
                                |
                                v
                          [Return new insight]
```

## קבצים שישתנו

1. **Migration חדשה**: יצירת טבלה `child_daily_insights`
2. **`supabase/functions/generate-daily-insights/index.ts`**: הוספת לוגיקת cache בDB
3. **`src/pages/DailyReport.tsx`**: הסרת sessionStorage cache (אופציונלי - לפשט את הקוד)

## הערות נוספות

- הפתרון לא דורש cron jobs או pg_cron
- המחזוריות לפי day_of_week מבטיחה retention אוטומטי של 7 ימים
- אפשר להוסיף בעתיד TTL-based invalidation אם צריך לייצר insights חדשים באותו יום

