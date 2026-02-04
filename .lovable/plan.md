

# תוכנית: תובנות יומיות - Partial vs Conclusive

## הבנת הבעיה

המימוש הנוכחי מחזיר תמיד את התובנה השמורה אם קיימת, ללא בדיקה:
- האם עבר זמן מספיק מאז יצירתה (עבור היום)
- האם מדובר בתובנה חלקית שנוצרה לפני חצות (עבור ימים קודמים)

## ארכיטקטורת הפתרון

### עקרונות מנחים

```text
┌─────────────────────────────────────────────────────────────────┐
│                    REQUEST FOR DATE X                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  IS DATE X == TODAY?                                            │
│  ├── YES ─────────────────────────────────────────────────────► │
│  │        ┌─ No existing insight → CREATE NEW                   │
│  │        │                                                      │
│  │        └─ Insight exists:                                    │
│  │             • created_at < 1 hour ago → RETURN CACHED        │
│  │             • created_at >= 1 hour ago → CREATE NEW          │
│  │             • created_at after 23:55 → RETURN CACHED         │
│  │                                                               │
│  └── NO (PAST DATE) ──────────────────────────────────────────► │
│           ┌─ No existing insight → CREATE CONCLUSIVE            │
│           │                                                      │
│           └─ Insight exists:                                    │
│                • is_conclusive = TRUE → RETURN CACHED           │
│                • is_conclusive = FALSE → CREATE CONCLUSIVE      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### שינויי סכמה

הוספת עמודה חדשה לטבלה `child_daily_insights`:

```sql
ALTER TABLE child_daily_insights
ADD COLUMN is_conclusive boolean NOT NULL DEFAULT false;
```

**משמעות:**
- `is_conclusive = false` → תובנה חלקית (נוצרה במהלך היום)
- `is_conclusive = true` → תובנה סופית (מכסה את כל היום 00:00-24:00)

### לוגיקה חדשה ב-Edge Function

```text
INPUT: child_id, date, current_time (Israel TZ)

1. COMPUTE:
   - today = current Israel date
   - is_today = (date == today)
   - day_of_week = date.getUTCDay()

2. FETCH existing insight:
   SELECT * FROM child_daily_insights
   WHERE child_id = ? AND day_of_week = ? AND insight_date = ?

3. DECISION TREE:

   IF no existing insight:
     → CREATE NEW (is_conclusive = !is_today)

   ELSE IF is_today:
     - hours_since_creation = (now - created_at) / 3600000
     - created_hour = created_at in Israel TZ
     
     IF hours_since_creation < 1:
       → RETURN CACHED
     
     ELSE IF created_hour >= 23 AND created_minute >= 55:
       → RETURN CACHED (too close to midnight)
     
     ELSE:
       → CREATE NEW (is_conclusive = false)
       → UPSERT (replaces old)

   ELSE (past date):
     IF existing.is_conclusive == true:
       → RETURN CACHED (final, never regenerate)
     
     ELSE:
       → CREATE NEW (is_conclusive = true)
       → UPSERT (upgrades to conclusive)
```

### Edge Cases מטופלים

| מצב | התנהגות |
|-----|---------|
| בקשה ל"היום" ללא תובנה קיימת | יצירת תובנה חלקית חדשה |
| בקשה ל"היום" כשעבר פחות משעה | החזרת cached |
| בקשה ל"היום" כשעברה שעה+ | יצירת תובנה חדשה (מחליפה) |
| בקשה ל"היום" כשנוצר ב-23:55+ | החזרת cached (לא מייצרים לפני חצות) |
| בקשה ל"אתמול" ללא תובנה | יצירת תובנה סופית |
| בקשה ל"אתמול" עם תובנה חלקית | יצירת תובנה סופית (מחליפה) |
| בקשה ל"אתמול" עם תובנה סופית | החזרת cached (לעולם לא מתחלף) |
| מעבר חצות - בקשה ראשונה ליום הקודם | יצירת תובנה סופית |

### שינויים בקבצים

#### 1. Migration חדשה

```sql
-- הוספת עמודה is_conclusive
ALTER TABLE public.child_daily_insights
ADD COLUMN is_conclusive boolean NOT NULL DEFAULT false;

-- סימון כל התובנות הקיימות כסופיות (הן עבור ימים שעברו)
UPDATE public.child_daily_insights
SET is_conclusive = true
WHERE insight_date < CURRENT_DATE;
```

#### 2. עדכון Edge Function: `generate-daily-insights/index.ts`

**שינויים עיקריים:**

א. **חישוב זמן נוכחי באזור זמן ישראל:**
```typescript
const israelNow = new Date(new Date().toLocaleString("en-US", { 
  timeZone: "Asia/Jerusalem" 
}));
const todayIsrael = israelNow.toISOString().split("T")[0];
const isToday = (date === todayIsrael);
```

ב. **לוגיקת החלטה חדשה:**
```typescript
if (cachedInsight) {
  const isConclusive = cachedInsight.is_conclusive;
  
  if (!isToday) {
    // Past date - return if conclusive, otherwise regenerate
    if (isConclusive) {
      return cached;
    }
    // Fall through to regenerate as conclusive
  } else {
    // Today - check time since creation
    const hoursSinceCreation = (Date.now() - new Date(cachedInsight.created_at).getTime()) / 3600000;
    const createdInIsrael = new Date(cachedInsight.created_at).toLocaleString("en-US", { 
      timeZone: "Asia/Jerusalem" 
    });
    const createdHour = new Date(createdInIsrael).getHours();
    const createdMinute = new Date(createdInIsrael).getMinutes();
    
    if (hoursSinceCreation < 1) {
      return cached; // Too recent
    }
    
    if (createdHour >= 23 && createdMinute >= 55) {
      return cached; // Created very late, don't regenerate
    }
    
    // Fall through to regenerate
  }
}
```

ג. **שמירה עם דגל `is_conclusive`:**
```typescript
const isConclusive = !isToday;

await serviceClient.from('child_daily_insights').upsert({
  child_id,
  day_of_week: dayOfWeek,
  insight_date: date,
  is_conclusive: isConclusive,
  headline: parsed.headline,
  insights: parsed.insights,
  // ...
}, { onConflict: 'child_id,day_of_week' });
```

### 3. אין שינוי ב-Frontend

ה-Frontend ממשיך לקרוא ל-Edge Function באותו אופן - הלוגיקה החדשה שקופה לצד הלקוח.

### תרשים זרימה מעודכן

```text
[Frontend] ───────────────────────────────────────────────►
              │
              │ POST { child_id, date }
              ▼
┌─────────────────────────────────────────────────────────┐
│           generate-daily-insights                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Compute: todayIsrael, isToday                       │
│                                                          │
│  2. Query DB for existing insight                       │
│                                                          │
│  3. Decision:                                           │
│     ├── PAST + conclusive → return cached               │
│     ├── PAST + partial → regenerate as conclusive       │
│     ├── TODAY + < 1hr ago → return cached               │
│     ├── TODAY + created 23:55+ → return cached          │
│     └── TODAY + >= 1hr ago → regenerate as partial      │
│                                                          │
│  4. If regenerate:                                      │
│     ├── Call OpenAI                                     │
│     ├── UPSERT to DB (is_conclusive = !isToday)         │
│     └── Return new insight                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
              │
              ▼
[Response: { headline, insights, cached, is_conclusive }]
```

### תוצאות צפויות

| מדד | לפני | אחרי |
|-----|------|------|
| קריאות AI ליום/ילד | עד N (כל רענון) | מקסימום 24 (שעה אחת) |
| קריאות AI לימים קודמים | 1 לכל רענון ראשון | 1 בלבד (סופית) |
| עקביות טקסט | משתנה בכל רענון | יציב תוך שעה, סופי ליום קודם |
| עלות OpenAI | גבוהה | מופחתת דרמטית |

### סדר ביצוע

1. **Migration** - הוספת `is_conclusive` + עדכון רשומות קיימות
2. **Edge Function** - עדכון לוגיקת ההחלטה
3. **בדיקה** - וידוא התנהגות תקינה בשני התרחישים (היום / עבר)

