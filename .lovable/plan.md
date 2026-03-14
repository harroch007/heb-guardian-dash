

## תוכנית: הצגת תמונת הוכחה במשימות

### מה צריך לקרות
1. **הוספת עמודה `proof_photo_base64`** לטבלת `chores` (text, nullable) — כי הסוכן שולח Base64
2. **עדכון ה-interface** ב-`useChores.ts` להכיל את השדה החדש
3. **עדכון `ChoreList.tsx`** — תמונה קטנה (thumbnail) בשורת המשימה + Dialog להצגה בגדול עם כפתורי אישור/דחייה

### שינויים

**Migration — עמודה חדשה:**
```sql
ALTER TABLE chores ADD COLUMN proof_photo_base64 text;
```

**`src/hooks/useChores.ts`:**
- הוספת `proof_photo_base64: string | null` ל-interface `Chore`

**`src/components/chores/ChoreList.tsx`:**
- אם `chore.proof_photo_base64` קיים — מציג אייקון מצלמה קטן או thumbnail (32x32) ליד שם המשימה
- לחיצה על התמונה/אייקון פותחת `Dialog` עם התמונה בגדול
- בתוך ה-Dialog: כפתורי "אשר" ו"דחה" (אם הסטטוס `completed_by_child`)
- התמונה מוצגת כ-`<img src="data:image/jpeg;base64,{value}" />`

### UX
- תמונה קטנה מעוגלת בשורת המשימה (רק אם יש תמונה)
- לחיצה → Dialog עם תמונה גדולה + כפתורי פעולה
- אם אין תמונה — הכל נשאר כמו היום

