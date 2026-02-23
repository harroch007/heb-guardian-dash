
# תיקון כיוון RTL בדשבורד ניהול

## הבעיה
למרות ש-`direction: rtl` מוגדר ב-CSS ו-`dir="rtl"` מוגדר על HTML, הלייאאוט בפועל מוצג LTR — טאבים, טבלאות, כרטיסיות ומשפך ההמרה כולם זורמים משמאל לימין במקום מימין לשמאל. בנוסף, השינויים הקודמים מ-properties פיזיים (`mr-`, `ml-`) ללוגיים (`ms-`, `me-`) גרמו להיפוך נוסף.

## גורם שורש
ה-`direction: rtl` בתוך `@layer base` ב-Tailwind עלול לא לקבל עדיפות מספיקה. בנוסף, רכיב ה-`TableHead` ב-shadcn/ui מגדיר `text-left` באופן קבוע, מה שסותר RTL.

## תוכנית תיקון

### שלב 1: חיזוק RTL גלובלי
**קובץ: `src/index.css`**
- העברת `direction: rtl` ל-OUTSIDE של `@layer base` כדי להבטיח שהוא לא מתעלם
- הוספת `text-align: right` ל-`html` כברירת מחדל

### שלב 2: תיקון רכיב Table
**קובץ: `src/components/ui/table.tsx`**
- שינוי `text-left` ל-`text-right` ברכיב `TableHead` (שורה 49)
- שינוי `pr-0` ל-`pl-0` ב-checkbox fallback (או שימוש ב-`pe-0`)

### שלב 3: ביטול שינויי Properties לוגיים
הם גרמו להיפוך כי ה-direction בפועל לא עובד כמצופה:

**קובץ: `src/pages/Admin.tsx`**
- שינוי חזרה: `-right-1` --> `-left-1` (נקודת queue)

**קובץ: `src/pages/admin/AdminOverview.tsx`**
- שינוי חזרה: `ms-auto` --> `ml-auto` (badge "לחץ לצפייה" — דוחף לסוף השורה = שמאל)

**קובץ: `src/pages/admin/AdminUsers.tsx`**
- שינוי חזרה: `me-1` --> `mr-1` (אייקון X ליד "סגור")

**קובץ: `src/pages/admin/AdminWaitlist.tsx`**
- שינוי חזרה: `ms-2` --> `ml-2` (x2, ריווח אחוזים)

### שלב 4: הוספת כיוון מפורש
**קובץ: `src/pages/Admin.tsx`**
- הוספת `style={{ direction: 'rtl' }}` על הקונטיינר הראשי כגיבוי

## סיכום קבצים לעדכון

| קובץ | שינוי |
|-------|-------|
| `src/index.css` | חיזוק `direction: rtl` מחוץ ל-layer |
| `src/components/ui/table.tsx` | `text-left` --> `text-right` |
| `src/pages/Admin.tsx` | `-right-1` --> `-left-1` + style inline |
| `src/pages/admin/AdminOverview.tsx` | `ms-auto` --> `ml-auto` |
| `src/pages/admin/AdminUsers.tsx` | `me-1` --> `mr-1` |
| `src/pages/admin/AdminWaitlist.tsx` | `ms-2` --> `ml-2` (x2) |

## הערה
השינויים האלה משתמשים ב-properties פיזיים (`ml-`, `mr-`, `left-`, `right-`) שעובדים באופן עקבי ללא תלות ב-CSS direction. זה הגישה הבטוחה ביותר עד שנוודא ש-`direction: rtl` באמת נכנס לתוקף בכל הדפדפנים.
