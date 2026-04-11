

# הסרת SyncNotice ("מחיל שינויים...")

## למה
כל ניווט בין דפים/טאבים ממילא מרענן את הדאטה (React Query refetch on mount). הבאנר "מחיל שינויים..." מיותר ומבלבל.

## שינויים

### 1. הסרת `<SyncNotice>` מהדפים
- **`src/pages/ChildDashboard.tsx`** — הסרת הקומפוננטה
- **`src/pages/ChildControlV2.tsx`** — הסרת הקומפוננטה

### 2. ניקוי קבצים
- מחיקת `src/components/child-dashboard/SyncNotice.tsx`
- הסרת הייצוא מ-`src/components/child-dashboard/index.ts`

### 3. ניקוי CommandStatusBanner (אם קיים באותם דפים)
- בדיקה אם `CommandStatusBanner` גם מציג הודעות sync מיותרות והסרתו במידת הצורך

## תוצאה
ההורה לא יראה יותר ספינר "מחיל שינויים..." — הנתונים מתרעננים אוטומטית בכל ניווט.

