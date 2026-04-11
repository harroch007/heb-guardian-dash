

# מסך Checkout V2 — עיצוב מחדש בסגנון V2

## סיכום
יצירת גרסת V2 של מסך ה-Checkout בסגנון "Light Premium" של שאר מסכי ה-V2, עם BottomNavigationV2 וניווט נכון.

## שינויים

### 1. עדכון `src/pages/Checkout.tsx`
- החלפת `<DashboardLayout>` ב-wrapper של `homev2-light` + `<BottomNavigationV2 />` (כמו SettingsV2, FamilyV2)
- שימוש ב-`rounded-2xl bg-card border border-border/50` לכרטיסיות (כמו שאר מסכי V2)
- כפתור חזרה בראש העמוד (`ChevronRight` + ניווט אחורה)
- אחרי שדרוג מוצלח — ניווט ל-`/home-v2` במקום `/dashboard`
- מצבי ריק (אין ילדים, כולם כבר Premium) — גם בעטיפת V2

### 2. עדכון ניווטים אל `/checkout`
כל ההפניות ל-`/checkout` כבר קיימות ונכונות — אין צורך בשינוי נתיבים. רק הניווט **מ**-checkout חזרה צריך עדכון:
- `navigate("/dashboard")` → `navigate("/home-v2")` (בכל 3 המקומות בקובץ)

### 3. עיצוב ספציפי
- Header: אייקון Shield בתוך עיגול `bg-primary/10`, כותרת + תיאור
- כרטיסי ילדים / פיצ'רים / קופון / מחיר: `rounded-2xl bg-card border border-border/50 p-5`
- כפתורי תשלום: אותו סגנון רק עם `rounded-xl`
- הדיאלוג "המערכת סגורה" נשאר כמו שהוא

## תוצאה
מסך checkout אחיד עיצובית עם שאר מסכי V2, עם ניווט תחתון וחזרה ל-home-v2.

