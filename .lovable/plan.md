

## תוכנית: צמצום רעש התראות מערכת

### בעיות שזוהו
1. מכשירים פעילים (last_seen היום) מקבלים התראת "לא מגיב" רק כי לא הגיבו לפקודת LOCATE ספציפית
2. מכשירים ישנים (לא נראו ימים/שבועות) ממשיכים לקבל פקודות ולייצר התראות חוזרות
3. התראות מערכת חסרות `ai_verdict` ולכן לא מגיעות להורים דרך ה-view, אבל מנפחות מספרים באדמין

### שינויים מוצעים

**1. תיקון `check_unresponsive_devices()` — סינון חכם יותר**
- לפני יצירת התראה, לבדוק אם `devices.last_seen` חדש (פחות מ-60 דקות). אם כן — המכשיר חי, לא צריך התראה
- זה מבטל false positives על מכשירים פעילים

**2. תיקון `send_locate_to_all_devices()` — לא לשלוח למכשירים ישנים**
- להוסיף פילטר: רק מכשירים עם `last_seen > now() - interval '7 days'` יקבלו LOCATE_NOW
- מכשיר שלא נראה שבוע — כבר לא רלוונטי לבדיקת מיקום

**3. הוספת `ai_verdict = 'notify'` ו-`category = 'system'` להתראות מערכת**
- ב-`check_unresponsive_devices()`: להוסיף `ai_verdict = 'notify'` כדי שההתראה תיכנס ל-`parent_alerts_effective`
- להוסיף `category = 'system'` כדי לסמן אותן ברור
- רלוונטי גם ל-`check-device-health` Edge Function

**4. ניקוי פקודות PENDING ישנות**
- פקודות LOCATE_NOW שנשארו PENDING ביותר מ-2 שעות — לסמן כ-`EXPIRED` כדי שלא יצטברו

### היקף השינויים
- מיגרציית DB אחת: עדכון שתי פונקציות (`check_unresponsive_devices`, `send_locate_to_all_devices`) + פקודת UPDATE לפקודות ישנות
- עדכון Edge Function `check-device-health` (הוספת verdict + category)
- אין שינויי UI

