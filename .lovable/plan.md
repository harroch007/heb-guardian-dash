

## תוכנית: הוספת טאב "מרכז עזרה" לדשבורד הניהול

### קובץ חדש: `src/pages/admin/AdminHelpCenter.tsx`
- כותרת: "שימוש בקיפי עם Google Family Link"
- תיבת הודעה מעוצבת (RTL) עם הטקסט המלא של הודעת WhatsApp
- כפתור "העתק ללוח" עם toast הצלחה
- עיצוב מינימלי ומקצועי

### עדכון: `src/pages/Admin.tsx`
1. הוספת import ל-`AdminHelpCenter` ו-icon `HelpCircle` מ-lucide
2. שינוי grid מ-`grid-cols-6` ל-`grid-cols-7` (שורה 679)
3. הוספת `TabsTrigger` חדש עם value="help" וטקסט "מרכז עזרה"
4. הוספת `TabsContent` עם value="help" שמרנדר את `<AdminHelpCenter />`

