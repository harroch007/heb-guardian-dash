

# שיפור מקיף לתצוגת התראות

## הבעיות שזוהו

1. **גובה קבוע של הכרטיס** (720px/580px) גורם לגלילה מיותרת גם כשיש מקום במסך
2. **"מה המשמעות?"** תמיד מתחיל ב-"כמו הורה," -- זה מגיע מה-AI prompt וזה חוזר על עצמו
3. **סקשן "מה המשמעות?" מיותר כסקשן נפרד** -- עדיף לשלב את המשמעות בתוך ההתראה עצמה
4. **כותרות מלחיצות מדי** -- "הודעה המכילה איומים חמורים על חיים" כשהילד בכלל לא מעורב ישירות. ה-AI לא מבחין מספיק בין מצב שהילד שלח/קיבל לבין מצב שהוא רק ראה את ההודעה

## הפתרון

### שלב 1: תיקון ה-AI Prompt (Edge Function)
**קובץ:** `supabase/functions/analyze-alert/index.ts`

- שינוי הוראת `meaning` בפרומפט: במקום "What does this mean for me as a parent?" לכתוב הוראה שתמנע פתיחה ב"כמו הורה" ותדרוש משפט תמציתי שמסביר את המצב
- הוספת שדה חדש `child_role` לתוצאת ה-AI: "sender" / "target" / "bystander" / "unknown"
- שינוי הוראות הכותרת: כשהילד הוא רק bystander, הכותרת צריכה להיות רגועה יותר (למשל "תוכן בעייתי נצפה בשיחה" במקום "הודעה המכילה איומים חמורים")
- הוספת הנחיה ל-summary: כשהילד לא מעורב ישירות, לציין את זה בסיכום ("נצפה תוכן אלים בשיחה - הילד לא היה מעורב ישירות")

### שלב 2: עדכון שמירת child_role ב-DB
**קובץ:** `supabase/functions/analyze-alert/index.ts`

- שמירת `child_role` מתוצאת ה-AI לעמודה הקיימת `child_role` בטבלת alerts

### שלב 3: תצוגה דינמית (ללא גובה קבוע)
**קובץ:** `src/components/alerts/AlertCardStack.tsx`

- הסרת `h-[720px] sm:h-[580px]` והחלפה ב-`min-h-0` דינמי
- שימוש ב-`max-h-[calc(100vh-200px)]` עם `overflow-y-auto` רק כשצריך
- הכרטיס יתאים את עצמו לתוכן

### שלב 4: מיזוג "מה המשמעות?" לתוך ההתראה
**קובץ:** `src/components/alerts/AlertCardStack.tsx`

- הסרת הסקשן הנפרד "מה המשמעות?" עם האייקון והכותרת
- שילוב תוכן ה-`ai_meaning` בסוף ה-`ai_context` או כחלק מהסיכום הראשי
- התוצאה: זרימת קריאה חלקה יותר -- סיכום -> הקשר+משמעות -> המלצה

### שלב 5: הצגת תפקיד הילד בהתראה
**קובץ:** `src/components/alerts/AlertCardStack.tsx`

- כשהילד הוא bystander, הוספת Badge קטן "הילד לא מעורב ישירות" בצבע ירוק/כחול רגוע
- כשהילד הוא sender/target, הצגת Badge בצבע אזהרה בהתאם

---

## פרטים טכניים

### שינויים ב-AI Prompt (analyze-alert)
```
// Before:
"meaning": "<Hebrew, 1 sentence - what this means for parent>"

// After:
"meaning": "<Hebrew, 1 sentence - concise interpretation. NEVER start with 'כמו הורה' or 'כהורה'. Just state the insight directly.>"
"child_role": "sender" | "target" | "bystander" | "unknown"
```

הוספת הנחיות לכותרת:
- כש-child_role הוא bystander: הכותרת צריכה להיות מתונה
- הסיכום חייב לציין אם הילד לא מעורב ישירות

### שינויים ב-AlertCardStack
- הסרת container עם גובה קבוע
- מיזוג ai_meaning לתוך flow הטקסט (אחרי ai_context, לפני separator)
- הסרת סקשן "מה המשמעות?" הנפרד
- הוספת Badge לתפקיד הילד

### שינויים ב-DB Update (processAlert)
```typescript
// הוספה ל-updateData:
child_role: aiResult.child_role || null,
```

