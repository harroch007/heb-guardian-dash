
# תיקון מבנה RTL בדשבורד ניהול

## הבעיה
למרות ש-`dir="rtl"` מוגדר על ה-container הראשי, חלק מהאלמנטים משתמשים בכיוונים פיזיים (left/right) במקום לוגיים (start/end), מה שגורם למיקום שגוי ברכיבים מסוימים.

## שינויים נדרשים

### 1. Admin.tsx — אינדיקטור תור (נקודה אדומה)
שורה 677: `absolute -top-1 -left-1` צריך להיות `absolute -top-1 -right-1` כי ב-RTL הנקודה צריכה להופיע בפינה השמאלית-עליונה של הטאב (שזה left ב-LTR אבל right ב-RTL context של Tailwind).

### 2. AdminOverview.tsx — Badge "לחץ לצפייה"
שורה 74: `mr-auto` צריך להיות `ms-auto` (margin-inline-start) כדי לדחוף את הבאדג' לצד הנכון ב-RTL.

### 3. AdminUsers.tsx — אייקון חיפוש + ריווח
- שורה 207: `right-3` ו-`pr-10` תקינים ב-RTL (האייקון בצד ימין = תחילת השורה). **נשאר כמו שהוא.**
- שורה 327: `ml-1` על אייקון X ליד "סגור" — צריך להיות `me-1` (margin-inline-end).

### 4. AdminWaitlist.tsx — ריווח אחוזים
- שורות 171, 185: `mr-2` על span של אחוזים — צריך להיות `ms-2` (margin-inline-start).
- שורה 221: `pr-10` על input חיפוש — תקין ב-RTL. **נשאר.**

### 5. Recharts — גרפים
גרפי Recharts לא תומכים ב-RTL באופן מובנה. ציר ה-X תמיד רץ משמאל לימין. זה מקובל ומובן גם בהקשר של עברית (ציר זמן הולך משמאל לימין) ולכן **לא נשנה את הגרפים**.

## סיכום קבצים לעדכון

| קובץ | שינוי |
|-------|-------|
| `src/pages/Admin.tsx` | `-left-1` -> `-right-1` (נקודת queue) |
| `src/pages/admin/AdminOverview.tsx` | `mr-auto` -> `ms-auto` |
| `src/pages/admin/AdminUsers.tsx` | `ml-1` -> `me-1` |
| `src/pages/admin/AdminWaitlist.tsx` | `mr-2` -> `ms-2` (x2) |

## הערה
אלו שינויים קטנים בקלאסים של Tailwind. הגרפים, הטבלאות, וה-Tabs כבר עובדים נכון ב-RTL בזכות `dir="rtl"` על ה-container.
