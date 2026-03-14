

## תוכנית: הצגת שמות ההרשאות החסרות בבאנר הבעיה

### הבעיה
ב-`ProblemBanner.tsx`, כשיש הרשאות חסרות, מוצג רק "1 הרשאות חסרות במכשיר" בלי לפרט איזה הרשאות. המידע כבר קיים ב-`deviceHealth.permissions` ומיפוי השמות קיים ב-`DeviceHealthBanner.tsx` (`PERMISSION_LABELS`).

### הפתרון
בקובץ `src/components/child-dashboard/ProblemBanner.tsx`:

1. להוסיף מיפוי `PERMISSION_LABELS` (אותו מיפוי שכבר קיים ב-`DeviceHealthBanner`) או לייבא אותו.
2. בשורה 33, לשנות את ה-`detail` כך שיציג את שמות ההרשאות החסרות במקום "הניטור עלול להיות חלקי".

לדוגמה, ה-detail ישתנה ל:
`"חסר: שירות נגישות, מיקום"` (רשימה של שמות ההרשאות בעברית)

### קבצים שישתנו
- `src/components/child-dashboard/ProblemBanner.tsx` — הוספת מיפוי שמות + שינוי detail

### ללא שינוי ב
- `DeviceHealthBanner.tsx` — נשאר כמו שהוא
- שום קובץ אחר

