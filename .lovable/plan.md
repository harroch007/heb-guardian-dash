

# זיהוי התנהגויות חיוביות -- "KippyAI רואה גם את הטוב"

## הרעיון

עד עכשיו המערכת מזהה רק סכנות. כל הודעה שהיא "safe" נבלעת ולא מגיעה להורה. הפיצ'ר הזה יגרום ל-AI לזהות גם התנהגויות חיוביות ולהתריע עליהן -- חיזוק חיובי שהורים אוהבים לשמוע.

## דוגמאות למה שנזהה

- הילד עוזר לחבר שמתקשה
- מסיט שיחה מבריונות או מגן על מישהו
- מתבטא בצורה בוגרת ויפה
- תומך ברגשות של חבר/ה
- עוזר לאח/ות
- מראה אמפתיה, אחריות, או בגרות

## איך זה עובד טכנית

### שלב 1: שדה חדש בטבלת alerts

נוסיף עמודה `alert_type` לטבלת `alerts`:

```text
alert_type: "warning" (ברירת מחדל, כל ההתראות הקיימות) | "positive"
```

### שלב 2: עדכון ה-AI Prompt

נרחיב את ה-SYSTEM_PROMPT ב-`analyze-alert` כך שהוא יזהה גם התנהגות חיובית:

- שדה חדש ב-JSON: `"positive_behavior"` (object או null)
- כשה-AI מזהה התנהגות חיובית בולטת, הוא מחזיר:
  ```text
  "positive_behavior": {
    "detected": true,
    "type": "empathy" | "leadership" | "maturity" | "helpfulness" | "defense" | "expression",
    "summary": "דניאל הגן על חבר שהציקו לו בקבוצה",
    "parent_note": "הילד שלך הראה בגרות ואמפתיה -- שווה לציין את זה בשיחה איתו"
  }
  ```
- כשאין התנהגות חיובית בולטת: `"positive_behavior": null`

חשוב: זיהוי חיובי יכול לקרות גם כשיש סכנה (למשל, הילד מגן על מישהו בשיחה אלימה). לכן `positive_behavior` הוא שדה נפרד מה-verdict.

### שלב 3: לוגיקה ב-Edge Function

ב-`processAlert`, אחרי שמקבלים תוצאה מה-AI:

1. אם `positive_behavior.detected === true`:
   - אם ה-verdict הוא "safe" או "monitor" (אין סכנה אמיתית): ניצור **רשומה חדשה** בטבלת alerts עם `alert_type = "positive"`, `ai_verdict = "positive"`, וה-summary/recommendation מתוך `positive_behavior`
   - אם ה-verdict הוא "review" או "notify" (יש גם סכנה): נעדכן את הרשומה הקיימת עם שדות ה-positive כ-metadata נוסף, ובנוסף ניצור רשומה חיובית נפרדת

2. התראות חיוביות לא נשלחות כ-push notification (לא דחוף) -- הן מופיעות בדף ההתראות בלבד

### שלב 4: UI -- כרטיס חיובי בדף ההתראות

- טאב שלישי בדף ההתראות: "חיוביות" (בנוסף ל"חדשות" ו"שמורות")
- כרטיס חיובי בעיצוב ירוק/חם במקום כתום/אדום:
  - אייקון: כוכב או לב במקום משולש אזהרה
  - צבע: `success` (ירוק) או גוון חם
  - כותרת: "כל הכבוד! דניאל הגן על חבר"
  - תוכן: הסבר קצר + הצעה להורה ("ספרו לו שאתם גאים")
  - כפתור: "ראיתי, תודה!" (acknowledge)

### שלב 5: עדכון ה-View

ה-view `parent_alerts_effective` צריך לכלול גם התראות חיוביות (בלי threshold filtering -- כל positive alert מגיע להורה).

## קבצים שישתנו

| קובץ | שינוי |
|-------|-------|
| `supabase/migrations/new.sql` | הוספת עמודה `alert_type` עם default "warning" |
| `supabase/functions/analyze-alert/index.ts` | הרחבת prompt + לוגיקה ליצירת התראות חיוביות |
| `src/pages/Alerts.tsx` | טאב שלישי "חיוביות", fetch עם filter על `alert_type` |
| `src/components/alerts/AlertTabs.tsx` | הוספת טאב שלישי |
| `src/components/alerts/AlertCardStack.tsx` | תמיכה בכרטיסים חיוביים (עיצוב שונה) |
| `src/components/alerts/PositiveAlertCard.tsx` | קומפוננטה חדשה לכרטיס חיובי |
| `src/components/alerts/EmptyPositiveState.tsx` | מצב ריק לטאב חיוביות |
| migration sql | עדכון view `parent_alerts_effective` לכלול positive alerts |

## סיכון ועלות

- **עלות AI**: אין עלות נוספת -- אנחנו כבר מנתחים כל הודעה, רק מוסיפים שדה לתוצאה
- **False positives**: יכול להיות שה-AI יזהה נימוס בסיסי כ"חיובי". נגדיר threshold -- רק התנהגות באמת בולטת
- **תדירות**: הרוב המכריע של ההודעות הן שגרתיות. נצפה ל-1-3 התראות חיוביות ביום לכל היותר

