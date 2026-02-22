

# הוספת כרטיסי "אפליקציות חדשות" ו"שימוש לילי" לדשבורד

## סיכום
נוסיף שני כרטיסים חדשים לדשבורד ההורה שמציגים נתונים מהטבלאות החדשות (`app_alerts` ו-`nightly_usage_reports`). הכרטיסים יופיעו **רק כשיש נתונים** -- אם אין אפליקציות חדשות או שהילד לא השתמש בלילה, הם לא יוצגו כלל.

---

## מה יתווסף

### 1. כרטיס "אפליקציות חדשות שזוהו"
- מציג אפליקציות שהותקנו היום (מטבלת `app_alerts`)
- כולל שם האפליקציה, שעת הזיהוי
- אייקון מותאם לפי `package_name` (שימוש ב-`getAppIconInfo` הקיים)
- **לא מוצג כלל אם אין נתונים להיום**

### 2. כרטיס "שימוש לילי"
- מציג סיכום שימוש בין חצות ל-05:00 (מטבלת `nightly_usage_reports`)
- סך דקות השימוש + האפליקציה המובילה
- **לא מוצג כלל אם אין דוח ללילה האחרון או אם total_minutes = 0**

### 3. מיקום בדשבורד
- שני הכרטיסים יופיעו **לפני** כרטיס "מצב המכשיר", מיד אחרי כרטיס AI Insights (לפרימיום) או אחרי כרטיס הפעילות הדיגיטלית (לחינמיים)
- הם גלויים לכל המשתמשים (לא רק פרימיום)

---

## פרטים טכניים

### קבצים חדשים:
1. **`src/components/dashboard/NewAppsCard.tsx`** -- כרטיס אפליקציות חדשות
   - Props: `childId: string`
   - שואל מ-`app_alerts` עם `child_id` ו-`created_at` של היום (Israel timezone)
   - מחזיר `null` אם אין תוצאות
   
2. **`src/components/dashboard/NightlyUsageCard.tsx`** -- כרטיס שימוש לילי
   - Props: `childId: string`
   - שואל מ-`nightly_usage_reports` עם `child_id` ו-`report_date` של היום
   - מחזיר `null` אם אין תוצאות או `total_minutes === 0`

### קבצים שישתנו:
1. **`src/pages/Dashboard.tsx`** -- הוספת שני הכרטיסים החדשים בתוך האזור שאחרי snapshot loading

### לוגיקת שליפה:
- `app_alerts`: `SELECT * FROM app_alerts WHERE child_id = X AND created_at >= today_israel ORDER BY created_at DESC`
- `nightly_usage_reports`: `SELECT * FROM nightly_usage_reports WHERE child_id = X AND report_date = today_israel LIMIT 1`
- שימוש ב-`getIsraelDate()` הקיים לחישוב התאריך

### עיצוב:
- כרטיס אפליקציות חדשות: אייקון `Download`, רקע כתום-צהוב עדין, רשימת אפליקציות עם שעת זיהוי
- כרטיס שימוש לילי: אייקון `Moon`, רקע כחול-כהה עדין, סך דקות + אפליקציה מובילה
- עקבי עם העיצוב הקיים של כרטיסי הדשבורד (Card, CardHeader, CardContent)
- RTL + עברית

