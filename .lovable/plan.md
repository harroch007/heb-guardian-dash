## למה זה לא הופיע

הוספנו את הספירה של "ילד סימן כבוצע, ממתין לאישורך" לטאב **משימות** בלבד (`useNavBadgeCounts.chores`). בטאב **בית** לא כללנו את זה (רק אפליקציות חדשות, בקשות תוספת זמן, ומכשירים מנותקים), וגם אין במסך הבית כרטיס ייעודי שמראה את המשימות שמחכות לאישור — הן מוצגות רק במטריקה "ממתינות לאישור" שב-`DailyControlSummary`, וזה רץ רק כשיש ילד יחיד. ולכן בריבוי-ילדים זה גם לא נראה בכלל ב-Home.

## מה נשנה

### 1. כרטיס חדש במסך הבית: "משימות שממתינות לאישורך"
קובץ חדש: `src/components/home-v2/HomePendingChoreApprovals.tsx`

- מציג את כל המשימות עם `status = 'completed_by_child'` עבור הילדים של ההורה.
- כל שורה: שם הילד · כותרת המשימה · דקות תגמול · אינדיקציה אם יש תמונת הוכחה.
- כפתורי "אשר" / "דחה" שמפעילים את אותם RPCs קיימים (`approve_chore`, `reject_chore`) — אותה לוגיקה כמו ב-`ChoreList`.
- רענון בזמן-אמת דרך Realtime על `chores` (כמו `HomePendingApps`).
- מוסתר כשאין משימות ממתינות.
- ממוקם ב-`HomeV2.tsx` מעל `HomePendingApps`.

### 2. עדכון ספירת התג בטאב הבית
`src/hooks/useNavBadgeCounts.ts`:
- מוסיפים את `choreApprovals` גם ל-`home` (בנוסף לטאב המשימות שכבר מקבל את זה).
- כך הספירה: `home = pendingApps + timeReqs + disconnected + choreApprovals`.
- ל-`chores` משאירים כפי שהוא — בלי שינוי בלוגיקה.

### 3. בלי שינויי DB / RLS / Edge Functions
משתמשים בלוגיקה הקיימת של `useChores` (ה-RPCs כבר עובדים בכל מסכי המשימות).

## קבצים מושפעים
- חדש: `src/components/home-v2/HomePendingChoreApprovals.tsx`
- ערוך: `src/pages/HomeV2.tsx` (לרנדר את הכרטיס)
- ערוך: `src/hooks/useNavBadgeCounts.ts` (להוסיף את `choreApprovals` ל-home)
