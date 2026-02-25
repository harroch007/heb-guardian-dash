

## תוכנית: שיפור כרטיס שימוש לילי + הוספה לסיכום יומי

### הבעיה הנוכחית
1. `NightlyUsageCard` מסתתר לגמרי כשאין דוח או כש-`total_minutes = 0`
2. אין מגבלת שעה — הכרטיס מוצג כל היום
3. הסיכום היומי (`DailyReport.tsx`) לא מציג נתוני שימוש לילי כלל

### שינויים מתוכננים

#### 1. `src/components/dashboard/NightlyUsageCard.tsx`
- שינוי הלוגיקה כך שתמיד יוצג עד 11:00 שעון ישראל:
  - אם יש דוח עם `total_minutes > 0` → מציג את הנתונים האמיתיים
  - אם יש דוח עם `total_minutes = 0` או אין דוח כלל → מציג "לא זוהה שימוש לילי 🎉"
  - אחרי 11:00 Israel → הכרטיס נעלם (`return null`)
- הוספת בדיקת שעה ישראלית (`isBeforeElevenAM`) שמחשבת את השעה הנוכחית ב-`Asia/Jerusalem`

#### 2. `src/pages/DailyReport.tsx`
- הוספת סקשן חדש "שימוש לילי" בדף הסיכום היומי
- שואב מ-`nightly_usage_reports` לפי `child_id` + `selectedDate`
- תמיד מוצג (ללא מגבלת שעה) — כי זה היסטוריה
- אותו עיצוב כמו בדשבורד: אם `total_minutes > 0` מראה נתונים, אם `0` או אין דוח → "לא זוהה שימוש לילי 🎉"
- ממוקם אחרי כרטיס הפעילות הדיגיטלית

### פרטים טכניים

**בדיקת שעה ישראלית:**
```typescript
const getIsraelHour = (): number => {
  const now = new Date();
  const israelTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  return israelTime.getHours();
};
```

**לוגיקת תצוגה ב-NightlyUsageCard:**
- `getIsraelHour() >= 11` → `return null`
- שליפת נתונים רגילה מ-DB
- אם אין דוח או `total_minutes === 0` → הצגת כרטיס חיובי ירוק
- אם `total_minutes > 0` → הצגת הנתונים כרגיל

**לוגיקת DailyReport:**
- `useEffect` נוסף שמביא `nightly_usage_reports` לפי `child_id` + `selectedDate`
- כרטיס חדש עם אייקון Moon, אותו סגנון כמו שאר הכרטיסים בדף

### קבצים שישתנו

| קובץ | שינוי |
|---|---|
| `src/components/dashboard/NightlyUsageCard.tsx` | לוגיקת תצוגה חדשה: תמיד עד 11:00, הודעה חיובית כשאין שימוש |
| `src/pages/DailyReport.tsx` | הוספת כרטיס שימוש לילי בסיכום היומי |

### אין שינויי DB
לא צריך migration — משתמשים בטבלה ובמבנה הקיימים.

