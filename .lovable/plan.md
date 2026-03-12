

## תוכנית: הסרת כפתור הסימולציה

כפתור "סמן כבוצע" הזמני כבר לא נחוץ — ה-RPC `complete_chore` עובד (אומת בלוגים, status 200), והאנדרואיד צריך לקרוא אליו ישירות.

### שינויים

**1. `src/components/chores/ChoreList.tsx`**
- הסרת כפתור ה-Play (סימולציה) מכל משימה pending
- הסרת ה-prop `onSimulateComplete` מ-`ChoreListProps` ומ-`ChoreItem`
- הסרת import של `Play`

**2. `src/hooks/useChores.ts`**
- הסרת פונקציית `simulateComplete`
- שמירת ה-polling fallback (כל 30 שניות) — זה שימושי באמת

**3. `src/pages/Chores.tsx`**
- הסרת העברת `simulateComplete` ל-`ChoreList`

### מה לעדכן את סוכן האנדרואיד

ה-PATCH הישיר קיבל 400. הוא חייב לעבור לקריאת RPC:
```kotlin
supabase.postgrest.rpc("complete_chore", mapOf("p_chore_id" to choreId))
```

