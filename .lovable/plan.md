
# תוכנית: הפרדת מדדי התראות + ניטור בריאות תור העיבוד

## רקע הבעיה
1. ה-KPI "התראות שנשלחו היום" מציג את מספר ההתראות שנוצרו (נכנסו לטבלת `alerts`), לא את אלו שבאמת נשלחו להורים
2. כש-`pg_net` לא פעיל, התור נתקע ואין שום אינדיקציה לכך בדשבורד הניהול

## מה ישתנה

### 1. הפרדת KPIs בדשבורד הניהול

הכרטיס הנוכחי "התראות שנשלחו היום" יוחלף בשלושה מדדים ברורים:

| מדד | מקור הנתון | צבע |
|------|-----------|------|
| התראות שנוצרו היום | `alerts` WHERE `created_at >= today` | כחול |
| עובדו ע"י AI | `alerts` WHERE `is_processed = true AND analyzed_at >= today` | סגול |
| נשלחו להורים | `alerts` WHERE `processing_status = 'notified' AND analyzed_at >= today` | כתום |

### 2. כרטיס בריאות תור (Queue Health)

כרטיס חדש בראש דשבורד הסקירה שיופיע רק כשיש בעיה:

- **תקוע** (אדום): יש התראות pending מעל 5 דקות
- **נכשל**: כמות התראות עם `status = 'failed'` בתור
- **תקין** (ירוק): אין בעיות

הכרטיס יציג:
- כמות pending בתור
- כמות failed בתור  
- זמן ההמתנה של ההתראה הישנה ביותר
- כפתור "הפעל עיבוד ידני" שקורא ל-`analyze-alert` ב-queue mode

### 3. מגמת התראות מורחבת (גרף 14 ימים)

הגרף הקיים של מגמת התראות יתעדכן להציג גם:
- קו חדש: "נשלחו להורים" (מבוסס על `processing_status = 'notified'`)

---

## פרטים טכניים

### שינויים בקובץ `src/pages/Admin.tsx`

1. הוספת שדות חדשים ל-`OverviewStats`:

```text
alertsCreatedToday: number      // COUNT from alerts WHERE created_at >= today
alertsAnalyzedToday: number     // COUNT WHERE is_processed = true AND analyzed_at >= today  
alertsNotifiedToday: number     // COUNT WHERE processing_status = 'notified' AND analyzed_at >= today
queuePending: number            // COUNT from alert_events_queue WHERE status = 'pending'
queueFailed: number             // COUNT WHERE status = 'failed'
oldestPendingMinutes: number    // age of oldest pending job in minutes
```

2. עדכון `fetchOverviewStats` לשלוף את הנתונים החדשים מ-Supabase:
   - שאילתת `alerts` עם פילטרים על `is_processed` ו-`processing_status`
   - שאילתת `alert_events_queue` לסטטוס התור

3. עדכון מגמת 14 ימים: הוספת `notified` count לכל יום (מבוסס על `processing_status = 'notified'`)

### שינויים בקובץ `src/pages/admin/AdminOverview.tsx`

1. החלפת כרטיס "התראות שנשלחו היום" בשלושה כרטיסים:
   - "התראות שנוצרו" (כחול)
   - "עובדו ע"י AI" (סגול)
   - "נשלחו להורים" (כתום)

2. הוספת כרטיס "בריאות תור" מותנה (מוצג רק אם יש pending > 0 או failed > 0):
   - רקע אדום/כתום אם יש בעיה
   - כפתור הפעלה ידנית שקורא ל-Edge Function

3. עדכון גרף מגמת התראות: הוספת קו "נשלחו" בצבע כתום

### קריאה ל-Edge Function (כפתור עיבוד ידני)

הכפתור יקרא ל-`analyze-alert` עם body ריק (queue mode) דרך `supabase.functions.invoke('analyze-alert', { body: {} })`.
כל לחיצה תעבד התראה אחת מהתור. אפשרות לכפתור "עבד את כולם" שיקרא בלולאה עד שאין עוד pending.

### אין שינויי מסד נתונים

כל הנתונים הנדרשים כבר קיימים בטבלאות `alerts` ו-`alert_events_queue`. אין צורך במיגרציה.
