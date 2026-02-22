

# סיכום שבועי וחודשי להורים

## מה נבנה

### 1. שמירת היסטוריית תובנות יומיות (פתרון בעיית ה-7 ימים)

כרגע הטבלה `child_daily_insights` דורסת נתונים אחרי 7 ימים (rolling window על `day_of_week`). נוסיף טבלה חדשה `child_periodic_summaries` שתשמור סיכומים שבועיים וחודשיים לצמיתות.

### 2. טבלה חדשה: `child_periodic_summaries`

```text
child_periodic_summaries:
  id: uuid (PK)
  child_id: uuid (FK)
  period_type: text ('weekly' | 'monthly')
  period_start: date
  period_end: date
  headline: text
  insights: text[]
  suggested_action: text
  severity_summary: text ('calm' | 'mixed' | 'intense')
  data_quality: text
  positive_highlights: text[] (התנהגויות חיוביות בולטות מהתקופה)
  stats_snapshot: jsonb (סטטיסטיקות מצטברות)
  created_at: timestamptz
  UNIQUE(child_id, period_type, period_start)
```

`stats_snapshot` ישמור נתונים כמו:
```text
{
  "total_messages": 450,
  "total_alerts": 12,
  "total_positive": 3,
  "avg_daily_messages": 64,
  "busiest_day": "2026-02-19",
  "top_apps": [...],
  "top_contacts": [...],
  "alert_categories": {"bullying": 3, "inappropriate": 2, ...}
}
```

### 3. Edge Function חדשה: `generate-periodic-summary`

מומחה AI נפרד ("Periodic Summary Expert") עם prompt ייעודי:

- **קלט**: מצטבר נתונים מ-7 ימים (שבועי) או ~30 ימים (חודשי)
- **מקורות נתונים**:
  - `device_daily_metrics` -- מטריקות יומיות (הודעות, AI, התראות)
  - `alerts` -- כל ההתראות מהתקופה (warning + positive)
  - `app_usage` -- שימוש באפליקציות
  - `daily_chat_stats` -- סטטיסטיקות צ'אטים
  - `child_daily_insights` -- תובנות יומיות קיימות (כקלט נוסף ל-AI)
- **פרסונה**: "מומחה מגמות" -- מזהה דפוסים לאורך זמן, לא מנתח יום בודד
- **הטון**: מקיף, מרגיע, מתמקד בתמונה הגדולה
- **מפתח AI**: `DAILY_INSIGHT_AI_KEY` (אותו מפתח, prompt שונה)
- **מודל**: GPT-4o-mini

### 4. Cron Jobs (תזמון)

שני cron jobs:

**סיכום שבועי**: כל יום חמישי בשעה 21:00 שעון ישראל (18:00 UTC)
```text
cron: '0 18 * * 4'  (כל יום חמישי ב-18:00 UTC = 21:00 ישראל)
```

**סיכום חודשי**: ביום האחרון של כל חודש בשעה 21:00 שעון ישראל
- מכיוון ש-pg_cron לא תומך ב-"יום אחרון בחודש" ישירות, נריץ כל יום ב-21:00 ישראל ונבדוק בקוד אם מחר הוא יום 1 (כלומר היום הוא האחרון בחודש)
- לחילופין: cron שרץ ב-28-31 בכל חודש ובודק בקוד

### 5. Push Notification

כשנוצר סיכום שבועי/חודשי, נשלח push notification להורה:
- שבועי: "הסיכום השבועי של [שם הילד] מוכן"
- חודשי: "הסיכום החודשי של [שם הילד] מוכן"

### 6. UI -- דף צפייה בסיכומים

- כפתור/לינק בדשבורד או בדף הדוח היומי: "סיכום שבועי" / "סיכום חודשי"
- דף חדש `PeriodicSummary.tsx` שמציג את הסיכום האחרון
- עיצוב דומה לדוח היומי אבל עם דגש על מגמות

## פרטים טכניים

### קבצים חדשים

| קובץ | תיאור |
|-------|--------|
| `supabase/migrations/new.sql` | טבלה `child_periodic_summaries` + RLS |
| `supabase/functions/generate-periodic-summary/index.ts` | Edge Function עם prompt ייעודי |
| `src/pages/PeriodicSummary.tsx` | דף UI לצפייה בסיכומים |

### קבצים שישתנו

| קובץ | שינוי |
|-------|-------|
| `supabase/config.toml` | הוספת `generate-periodic-summary` |
| `src/App.tsx` | route חדש `/summary/:childId/:type` |
| `src/pages/Dashboard.tsx` | לינק לסיכום השבועי/חודשי האחרון (אם קיים) |

### לוגיקת ה-Edge Function

1. מקבלת `child_id`, `period_type` ('weekly'/'monthly'), ו-`trigger` ('cron'/'manual')
2. מחשבת `period_start` ו-`period_end` בהתאם לסוג
3. שולפת נתונים מצטברים מכל הטבלאות הרלוונטיות
4. שולחת ל-AI עם prompt ייעודי למגמות
5. שומרת בטבלה `child_periodic_summaries`
6. שולחת push notification להורה

### הגדרת Cron

שתי שאילתות INSERT דרך SQL Editor (לא migration):
- שבועי: `cron.schedule('weekly-summary', '0 18 * * 4', ...)`
- חודשי: `cron.schedule('monthly-summary', '0 18 28-31 * *', ...)` עם בדיקה בקוד

### RLS Policies

- הורים יכולים לקרוא סיכומים של הילדים שלהם
- Service role יכול לנהל (insert/update)

### סדר ביצוע

1. יצירת טבלה + RLS
2. בניית Edge Function עם ה-prompt החדש
3. בניית דף UI
4. הגדרת Cron Jobs
5. חיבור push notifications

