
# בדיקת מנוי לפני ניתוח AI

## הבעיה
כרגע כל התראה שנכנסת נשלחת לניתוח AI (GPT-4o-mini) ללא קשר למסלול המנוי של הילד. משמעות: גם משתמשים חינמיים צורכים קריאות OpenAI יקרות.

## הפתרון
הוספת בדיקת `subscription_tier` בתוך הפונקציה `processAlert` ב-Edge Function `analyze-alert`. אם הילד במסלול חינמי, ההתראה תסומן כ-processed בלי לעבור ניתוח AI.

## מה יקרה למשתמש חינמי
- ההתראה עדיין תישמר בטבלת `alerts` (האפליקציה שולחת אותה)
- ה-Edge Function יזהה שהילד במסלול `free` ויסמן את ההתראה:
  - `is_processed = true`
  - `ai_verdict = 'skipped_free'`
  - `processing_status = 'skipped_free_tier'`
  - תוכן ההתראה יימחק (כמו שקורה בניתוח רגיל)
- ההתראה לא תופיע להורה (כי ב-Alerts.tsx מסוננות רק `notify` ו-`review`)
- לא תישלח Push notification

## פרטים טכניים

### קובץ: `supabase/functions/analyze-alert/index.ts`

בתוך `processAlert`, אחרי שליפת נתוני הילד (שורות 248-262), נוסיף:

1. שינוי השאילתה בשורה 249 כדי לכלול `subscription_tier`:
   ```
   .select('date_of_birth, gender, subscription_tier')
   ```

2. בדיקה מיד אחרי קבלת נתוני הילד — אם `subscription_tier` הוא `free` (או חסר):
   - עדכון ההתראה עם סטטוס `skipped_free_tier`
   - מחיקת התוכן (פרטיות)
   - החזרת תוצאה בלי קריאה ל-OpenAI
   - לוג ברור: `"Alert X skipped: child is on free tier"`

### אין שינויים בצד הלקוח
- דף ההתראות כבר מסנן רק `notify` ו-`review` (השינוי מהתיקון הקודם)
- התראות `skipped_free` פשוט לא יופיעו

### אין שינויים בטבלאות
- עמודת `subscription_tier` כבר קיימת בטבלת `children` עם ברירת מחדל `'free'`
