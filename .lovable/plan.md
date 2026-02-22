

# הוספת התראות חיוביות לדאשבורד ולתובנות AI

## מה ישתנה

### 1. כרטיס "רגע טוב" בדאשבורד

כרטיס ירוק חדש שיופיע בדאשבורד (בין כרטיס "פעילות דיגיטלית" לבין כפתור "סיכום אתמול") -- רק אם קיימת לפחות התראה חיובית אחת שלא אושרה.

- עיצוב ירוק/חם עם אייקון כוכב
- מציג את ההתראה החיובית האחרונה (כותרת + סיכום)
- כפתור "ראה הכל" שמנווט לטאב "חיוביות" בדף ההתראות
- לא מוצג כלל אם אין התראות חיוביות

### 2. שילוב בתובנות AI

ה-edge function `generate-daily-insights` יקבל גם נתונים על התראות חיוביות מהיום, וה-prompt יתעדכן כך שה-AI ישלב אותן בתובנות:

- שליפה של התראות חיוביות מהיום (alert_type = 'positive')
- הוספת `positive_alerts_context` ל-payload שנשלח ל-AI
- עדכון ה-SYSTEM_PROMPT כך שה-AI ייקח בחשבון גם התנהגויות חיוביות ויציין אותן בתובנות

## פרטים טכניים

### קבצים שישתנו

| קובץ | שינוי |
|-------|-------|
| `src/pages/Dashboard.tsx` | שליפת התראה חיובית אחרונה + הצגת כרטיס ירוק |
| `supabase/functions/generate-daily-insights/index.ts` | שליפת positive alerts + עדכון prompt |

### שליפת נתונים בדאשבורד

שליפה פשוטה מטבלת `alerts`:
```text
alerts WHERE child_id = X
  AND alert_type = 'positive'
  AND acknowledged_at IS NULL
  AND is_processed = true
  ORDER BY created_at DESC
  LIMIT 1
```

השליפה תתבצע במקביל ל-snapshot הקיים, בלי לשבור את מנגנון ה-cache.

### עדכון generate-daily-insights

- שליפה חדשה: `alerts WHERE alert_type = 'positive' AND child_id = X AND created_at in date range`
- הוספת שדה `positive_context` ל-payload עם: title, category, summary
- עדכון SYSTEM_PROMPT עם הנחיות:
  - אם יש positive_context, ציין את ההתנהגויות החיוביות בתובנות
  - תן להן משקל -- הורים רוצים לשמוע גם דברים טובים
  - אל תמציא התנהגויות חיוביות אם אין בנתונים
