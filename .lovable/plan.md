
# הפיכת רשומות אימון ללחיצות עם תצוגת תוכן מלא

## מה ישתנה

בטאב "Training" בדשבורד האדמין, כל שורה בטבלת רשומות האימון תהפוך ללחיצה. לחיצה על שורה תפתח דיאלוג (Dialog) שמציג את כל הפרטים של הרשומה.

## שינויים טכניים

### קובץ: `src/pages/admin/AdminTraining.tsx`

1. **הוספת imports**: Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription מ-`@/components/ui/dialog` + ScrollArea מ-`@/components/ui/scroll-area`.

2. **State חדש**: `selectedRecord` מסוג `TrainingRecord | null` לניהול הרשומה הנבחרת.

3. **שורות הטבלה**: הוספת `cursor-pointer` ו-`onClick` לכל `TableRow` שפותח את הדיאלוג עם הרשומה הנלחצת.

4. **דיאלוג חדש** שמציג:
   - כותרת: Alert ID (אם קיים) + תאריך יצירה
   - מטא-דאטה: גיל, מגדר, verdict, risk score
   - הטקסט המלא (`raw_text`) בתוך ScrollArea עם גובה מקסימלי, כיוון RTL, וגופן קריא
   - אם יש `ai_verdict` - הצגת כל שדות ה-JSON בצורה מפורמטת

אין שינויים בקבצים אחרים, אין שינויי סכימה.
