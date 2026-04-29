## הוספת ההורה השותף לכרטיס "משפחה" בהגדרות

כרגע בכרטיס **משפחה** במסך `/settings-v2` מופיעים רק הילדים. נוסיף הצגה של ההורה השותף (אם קיים) כך שההורה הראשי יראה את כל המשפחה במקום אחד, וגם ההורה השותף יראה את ההורה הראשי כחלק מהמשפחה.

### שינויים

**קובץ: `src/pages/SettingsV2.tsx`**

1. הוספת שליפה מ-`family_members`:
   - אם המשתמש הוא **owner** → שליפה לפי `owner_id = user.id` עם `status='accepted'` (יחזיר את ההורה השותף שצורף).
   - אם המשתמש הוא **co_parent** → שליפה של רשומת ה-owner שלו (כבר זמין דרך `useFamilyRole().membership.owner_id`) ואז שליפה של פרטי ה-owner מטבלת `parents` (full_name).
   - שמירה ב-state: `coParents: { name, email, role: 'owner'|'co_parent' }[]`.

2. עדכון תת-כותרת הכרטיס: במקום `"{childCount} ילדים מחוברים"` יוצג `"{childCount} ילדים • {parentsCount} הורים"`.

3. הוספת חלוקה ויזואלית בתוך הכרטיס:
   - **הורים** (כותרת משנה קטנה): רשימה של ההורה הראשי + ההורה השותף, כל אחד עם תווית: "הורה ראשי" / "הורה שותף" (badge קטן בסגנון של ה-badge הקיים `ShieldCheck`).
   - **ילדים** (כותרת משנה קטנה): הרשימה הקיימת של הילדים עם התווית פרימיום/חינמי.
   - השורה של המשתמש הנוכחי תסומן ב-"(אני)" קטן בצד.

4. אם אין הורה שותף וההמשתמש הוא owner → לא מציגים את הסקשן הורים בנפרד; אפשר להציג רמז קטן: "אפשר להוסיף הורה שותף ב'ניהול משפחה'".

### דוגמת מבנה JSX (בתוך הכרטיס משפחה הקיים)

```tsx
<div>
  <p className="text-xs text-muted-foreground mb-1.5">הורים</p>
  {parents.map(p => (
    <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground">{p.name}</span>
        {p.isMe && <span className="text-[10px] text-muted-foreground">(אני)</span>}
      </div>
      <Badge variant="secondary" className="text-[10px] ...">
        {p.role === 'owner' ? 'הורה ראשי' : 'הורה שותף'}
      </Badge>
    </div>
  ))}
</div>

<div className="pt-2">
  <p className="text-xs text-muted-foreground mb-1.5">ילדים</p>
  {/* רשימת הילדים הקיימת */}
</div>
```

### אבטחה ומידע אמיתי

- שימוש ב-RLS הקיים של `family_members` (owner רואה את הרשומות שלו; co-parent רואה רשומות בהן `member_id = auth.uid()`).
- שם ההורה הראשי עבור co-parent יישלף מ-`parents` (`full_name`) עם אותה לוגיקת ניקוי שמשמשת ב-`HomeGreeting` (להתעלם מערכים שמכילים `@`).
- אם השם חסר — fallback ל-`invited_name` או "הורה" (ללא mock).

### ללא שינוי

- אין שינוי ב-DB / RLS / Edge Functions.
- אין שינוי בכרטיס Account.
- כפתור "ניהול משפחה" נשאר.
