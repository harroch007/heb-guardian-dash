

## באג: Badge התראות מציג מספר שגוי למשתמשים חדשים

### שורש הבעיה

שתי בעיות שונות גורמות לזה:

**1. ה-View חשוף לכל המשתמשים (קריטי)**

במיגרציה האחרונה (`20260224171355`) ה-view `parent_alerts_effective` נוצר מחדש **בלי** `security_invoker=on`. בגרסה הקודמת (`20260222150306`) הוא היה עם `security_invoker=on`, מה שגרם ל-RLS של טבלת `alerts` לפעול. עכשיו ה-view מחזיר התראות של **כל** המשתמשים — ומשתמש חדש בלי ילדים רואה התראות של אחרים.

**2. Badge לא מסנן `saved_at`**

ב-`BottomNavigation.tsx` השאילתה לא מסננת `saved_at IS NULL`, אבל דף ההתראות עצמו כן מסנן. זה יכול לגרום לאי-התאמה נוספת בין המספר ב-badge לבין מה שמוצג בדף.

### תיקונים נדרשים

**קובץ 1: מיגרציה חדשה** — תיקון ה-view

יצירת מיגרציה שמוסיפה חזרה את `security_invoker=on` ל-view `parent_alerts_effective`, כדי שה-RLS של טבלת `alerts` יחול וכל משתמש יראה רק את ההתראות של הילדים שלו.

**קובץ 2: `src/components/BottomNavigation.tsx`** — שורה 33

הוספת סינון `.is('saved_at', null)` לשאילתה, כדי שה-badge יציג רק התראות חדשות (לא שמורות) — בדיוק כמו הטאב "חדשות" בדף ההתראות.

### פרטים טכניים

המיגרציה תריץ:
```sql
CREATE OR REPLACE VIEW parent_alerts_effective 
WITH (security_invoker=on) AS
-- ... (אותה שאילתה בדיוק, רק עם security_invoker)
```

ב-BottomNavigation, השאילתה תשתנה מ:
```typescript
.is('parent_message', null)
```
ל:
```typescript
.is('parent_message', null)
.is('saved_at', null)
```

