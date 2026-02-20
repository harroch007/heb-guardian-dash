
## העברת "משפך המרה" לטאב רשימת המתנה

### מה ייעשה
הכרטיס "משפך המרה" (Conversion Funnel) יועבר מטאב "סקירה כללית" לטאב "רשימת המתנה", כי הוא קשור ישירות לנתוני ה-Waitlist ושיעור ההמרה.

### שינויים טכניים

**קובץ: `src/pages/admin/AdminOverview.tsx`**
- הסרת בלוק ה-Conversion Funnel (שורות 460-511 בערך)
- הסרת ה-import של `TrendingUp` אם לא בשימוש אחר
- הסרת מיפוי `FUNNEL_TAB_MAP` (שורות 59-66) אם לא בשימוש אחר

**קובץ: `src/pages/admin/AdminWaitlist.tsx`**
- הוספת prop חדש `funnel` מסוג `{ stage: string; count: number }[]`
- הוספת כרטיס "משפך המרה" מעל טבלת רשימת ההמתנה (אותו עיצוב בדיוק - עיגולים עם קווים מחברים + שיעור המרה)
- הוספת import של `TrendingUp` מ-lucide-react

**קובץ: `src/pages/Admin.tsx`**
- העברת `funnel` data מ-`overviewStats` ל-`AdminWaitlist`:
  ```
  <AdminWaitlist
    entries={waitlist}
    loading={loading}
    onRefresh={fetchWaitlist}
    funnel={overviewStats?.funnel || []}
  />
  ```
