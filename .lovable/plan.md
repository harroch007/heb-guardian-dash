
# דף תשלום + מערכת פרומו קוד + סטטיסטיקות אדמין

## סקירה כללית

המערכת תכלול 4 חלקים עיקריים:

1. **דף תשלום (Checkout)** — דף חדש שנפתח מ-"שדרג עכשיו", עם טופס כרטיס אשראי מדומה + שדה פרומו קוד
2. **טבלת promo_codes בDB** — לניהול קודי הנחה עם חוקים גמישים
3. **טאב פרומו קודים באדמין** — יצירה, צפייה, ומחיקה של קודים
4. **KPI חינם/משלם באדמין** — הצגת כמה יוזרים חינם וכמה Premium בסקירה הכללית

---

## 1. דף תשלום — `/checkout`

### מה יוצג:
- סיכום מה ההורה מקבל (רשימת פיצ'רים Premium)
- מחיר: 19 ש"ח/חודש (או מחיר מותאם אם יש פרומו)
- **שדה פרומו קוד** עם כפתור "החל" — בודק מול הDB ומעדכן את המחיר בהתאם
- טופס כרטיס אשראי:
  - מספר כרטיס (16 ספרות)
  - תוקף (MM/YY)
  - CVV (3 ספרות)
  - שם בעל הכרטיס
- כפתור "שלם ושדרג"
- **כל מספר כרטיס יתקבל** — מדמה תשלום מוצלח
- לאחר "תשלום": עדכון `children.subscription_tier = 'premium'` + הפניה לדשבורד עם toast הצלחה

### שינויים:
- קובץ חדש: `src/pages/Checkout.tsx`
- עדכון `UpgradeModal.tsx`: במקום `window.open`, מנווט ל-`/checkout?childId=xxx`
- עדכון `App.tsx`: הוספת Route `/checkout` (מוגן)

---

## 2. טבלת promo_codes

```text
promo_codes:
  id          uuid (PK, default gen_random_uuid())
  code        text (unique, NOT NULL) — הקוד עצמו, למשל "WELCOME2024"
  discount_type text (NOT NULL) — סוג: 'free_months' | 'fixed_price' | 'percent_off'
  discount_value integer (NOT NULL) — ערך: מספר חודשים / מחיר קבוע / אחוז
  max_uses    integer (nullable) — מקסימום שימושים (null = ללא הגבלה)
  current_uses integer (default 0) — כמה פעמים כבר השתמשו
  expires_at  timestamptz (nullable) — תאריך תפוגה
  is_active   boolean (default true)
  created_at  timestamptz (default now())
```

### חוקי פרומו קוד (דוגמאות):
| discount_type | discount_value | משמעות |
|---|---|---|
| free_months | 1 | חודש חינם |
| free_months | 3 | 3 חודשים חינם |
| fixed_price | 10 | 10 ש"ח/חודש לתמיד |
| percent_off | 50 | 50% הנחה |

### RLS:
- Admin: SELECT, INSERT, UPDATE, DELETE
- Authenticated users: SELECT בלבד (לאימות קוד)

---

## 3. טאב "פרומו קודים" באדמין

### טאב חדש במערכת הניהול עם:
- **טופס יצירת קוד**: שדות code, סוג הנחה, ערך, מקסימום שימושים, תאריך תפוגה
- **טבלת קודים קיימים**: קוד, סוג, ערך, שימושים/מקסימום, סטטוס (פעיל/לא), פעולות (השבתה/מחיקה)

### קבצים:
- קובץ חדש: `src/pages/admin/AdminPromoCodes.tsx`
- עדכון `Admin.tsx`: הוספת טאב (TabsList יעבור מ-6 ל-7 עמודות)

---

## 4. KPI חינם/משלם בסקירה הכללית

### בAdminOverview:
- כרטיס KPI חדש: **"חינם / משלם"** — מציג כמה ילדים ב-free וכמה ב-premium
- נשאב מטבלת `children` לפי `subscription_tier`

### שינויים:
- עדכון `Admin.tsx` — fetchOverviewStats יוסיף ספירת free/premium
- עדכון `AdminOverview.tsx` — כרטיס KPI חדש
- עדכון הinterface `OverviewStats` בשני הקבצים

---

## שינויים טכניים — סיכום קבצים

| קובץ | שינוי |
|---|---|
| **DB Migration** | טבלת `promo_codes` + RLS policies |
| `src/pages/Checkout.tsx` | **חדש** — דף תשלום עם טופס כרטיס + פרומו קוד |
| `src/pages/admin/AdminPromoCodes.tsx` | **חדש** — טאב ניהול פרומו קודים |
| `src/components/UpgradeModal.tsx` | ניווט ל-`/checkout` במקום `window.open` |
| `src/App.tsx` | הוספת Route `/checkout` |
| `src/pages/Admin.tsx` | הוספת טאב פרומו + fetch free/premium counts |
| `src/pages/admin/AdminOverview.tsx` | כרטיס KPI חינם/משלם |
| `src/hooks/useSubscription.ts` | ללא שינוי (כבר קיים ועובד) |
