

## הבעיה

הקומפוננטה `ScreenTimeSection.tsx` (טאב הילד, זמן מסך) משתמשת ברשימת סינון **מקומית משלה** (`SYSTEM_FILTER` + `SYSTEM_KEYWORDS` + `isSystem`) במקום לייבא את `isSystemApp` מ-`appUtils.ts`. ברשימה המקומית הזו עדיין מופיע `com.samsung.android.messaging` (שורה 39), ולכן "הודעות" מוסתרת שם.

## תוכנית

### קובץ: `src/components/child-dashboard/ScreenTimeSection.tsx`

1. **מחיקת** `SYSTEM_FILTER`, `SYSTEM_KEYWORDS`, והפונקציה `isSystem` (שורות 27-68).
2. **ייבוא** `isSystemApp` מ-`@/lib/appUtils`.
3. **שינוי** שורה 124 מ-`!isSystem(...)` ל-`!isSystemApp(...)`.

זה מאחד את הסינון למקום אחד — כל שינוי עתידי ב-`appUtils.ts` ישפיע על כל התצוגות באופן אחיד.

