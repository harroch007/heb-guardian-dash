

## העברת כל המשתמשים לקבוצת ברירת מחדל

### מצב נוכחי
5 הורים ללא קבוצה:
- דני כהן (test.parent@kippy.app)
- אריק השני (eflashtwo@gmail.com)
- עידן סאסי (idansasi11@gmail.com)
- Yariv Harroch (yarivtm@gmail.com)
- yariv@kippyai.com (אדמין)

### שינוי נדרש
הרצת UPDATE על טבלת `parents` — שיוך כל ההורים עם `group_id IS NULL` לקבוצת "פרימיום" (ברירת מחדל):

```sql
UPDATE parents 
SET group_id = 'e5f5921f-8984-4c97-9d4b-29797622cba2' 
WHERE group_id IS NULL;
```

### פרטים טכניים
- קבוצת ברירת מחדל: **פרימיום** (ID: `e5f5921f-...`)
- מספר רשומות שיעודכנו: **5**
- אין שינוי בסכמה — רק עדכון נתונים
- Migration file חדש: `supabase/migrations/20260225110000_assign_parents_to_default_group.sql`

