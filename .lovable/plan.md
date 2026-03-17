

## תוכנית: חלוקת אחריות — Lovable (שרת) מול Android (מכשיר)

### הבעיה המרכזית

האנדרואיד שולח `totalTimeInForeground` מצטבר (cumulative) שלא מתאפס בחצות. השרת שומר אותו כמו שהוא. התוצאה: 18:57 שעות שימוש ליום אחד — בלתי אפשרי פיזית.

### מי אחראי למה

**Android — מקור האמת (source of truth)**
- חישוב שימוש יומי נקי (דלתא) לפני השליחה
- שליחת `usage_date` לפי `Asia/Jerusalem`
- Sanity check: לא לשלוח ערך > 1440 דקות לאפליקציה בודדת

**Lovable/Supabase — צד מציג בלבד (display layer)**
- שומר את מה שמקבל — ללא תיקונים, ללא דלתות
- מציג בדשבורד כמו שהוא

### מה צריך לתקן בצד Lovable (באג קיים)

הview `parent_daily_report` משתמש ב-**UTC** במקום `Asia/Jerusalem` ב-3 מקומות:

```text
שורה 86:  (now() AT TIME ZONE 'UTC')::date AS report_date
שורה 94:  WHERE ddh.check_date = (now() AT TIME ZONE 'UTC')::date
שורה 99:  WHERE au.usage_date = (now() AT TIME ZONE 'UTC')::date
```

זה יוצר פער של עד שעתיים (קיץ: 3 שעות) — בין 22:00 ל-00:00 בישראל הview מציג נתונים של מחר לפי UTC. צריך לתקן ל-`Asia/Jerusalem` בכל המקומות.

**הview `parent_home_snapshot` תקין** — כבר משתמש ב-`Asia/Jerusalem`.

### מה לשלוח לסוכן האנדרואיד

פרומפט מלא עם:

1. **תיאור הבאג** — `totalTimeInForeground` הוא cumulative, לא daily
2. **הפתרון הנדרש** — לחשב דלתא: `queryUsageStats(INTERVAL_DAILY, startOfDayInJerusalem, now)`
3. **חוזה ה-RPC** — מה `upsert_app_usage` מצפה לקבל (5 פרמטרים, `p_usage_minutes` = יומי בלבד, `p_usage_date` = תאריך ירושלים)
4. **Sanity checks** — מה לא לשלוח (> 1440 דקות)
5. **Timezone** — כל חישוב תאריך/שעה חייב להיות `Asia/Jerusalem`

### שינויים טכניים (צד Lovable)

**קובץ: מיגרציה חדשה** — תיקון `parent_daily_report` view:
- החלפת כל `AT TIME ZONE 'UTC'` ל-`AT TIME ZONE 'Asia/Jerusalem'` בחישובי report_date, health check_date, ו-usage_date
- אותו דבר ב-alert_counts ו-notify_effective CTEs

**קובץ: `.lovable/plan.md`** — עדכון התוכנית עם הפרומפט המלא לאנדרואיד + סטטוס הבאג

### סיכום חלוקה

```text
┌─────────────────────────────────────────────┐
│              ANDROID (מכשיר)                │
│  • חישוב דלתא יומית                        │
│  • תאריך לפי Asia/Jerusalem                │
│  • Sanity: max 1440 דק׳ לאפליקציה          │
│  • שולח נתון נקי ל-upsert_app_usage        │
└──────────────────┬──────────────────────────┘
                   │  p_usage_minutes = יומי בלבד
                   ▼
┌─────────────────────────────────────────────┐
│           SUPABASE (שרת)                    │
│  • upsert_app_usage: שומר כמו שהוא         │
│  • parent_home_snapshot: מציג (Jerusalem ✓) │
│  • parent_daily_report: מציג (UTC → לתקן!) │
│  • דשבורד: מושך ומציג                      │
└─────────────────────────────────────────────┘
```

