

# הוספת עורך טקסט הודעת WhatsApp באדמין

## גישה
הוספת כפתור "ערוך הודעה" מעל טבלת רשימת ההמתנה שפותח Dialog עם Textarea לעריכת תבנית ההודעה. התבנית נשמרת ב-`localStorage` כדי שתישאר גם אחרי רענון, בלי צורך בשינוי DB.

המשתנה `{parent_name}` ישמש כ-placeholder שיוחלף אוטומטית בשם ההורה בזמן השליחה.

## שינויים

### `src/pages/admin/AdminWaitlist.tsx`

1. **הוספת state חדש** — `messageTemplate` שנטען מ-`localStorage` עם ברירת מחדל של הטקסט הנוכחי, ו-`showTemplateEditor` לפתיחת/סגירת הדיאלוג

2. **הוספת Dialog לעריכת ההודעה** — כולל:
   - `Textarea` עם dir="rtl" להצגת ותבנית ההודעה
   - הסבר קצר שהמשתנה `{parent_name}` יוחלף אוטומטית
   - כפתורי "שמור" ו-"איפוס לברירת מחדל"
   - שמירה ל-`localStorage` בלחיצה על שמור

3. **כפתור "ערוך הודעה"** — מוצב ליד כותרת הכרטיס של רשימת ההמתנה (אייקון `MessageSquare` או `Edit`)

4. **עדכון `handleApprove`** — במקום הטקסט הקבוע, ישתמש ב-`messageTemplate` ויחליף `{parent_name}` בשם ההורה האמיתי

## imports חדשים
- `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription` מ-`@/components/ui/dialog`
- `Textarea` מ-`@/components/ui/textarea`
- `MessageSquare` מ-`lucide-react`

## סיכום
- קובץ אחד: `AdminWaitlist.tsx`
- אין שינוי DB — שמירה ב-`localStorage`
- המשתנה `{parent_name}` מוחלף דינמית
- ברירת מחדל = הטקסט הנוכחי (לא ישתנה שום דבר אם לא עורכים)

