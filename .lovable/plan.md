# תיקון תצוגת מחשב + שם הורה 2

## Issue 1 — אין ניווט בתצוגת מחשב

`BottomNavigationV2` מוגדר `md:hidden` (מוצג רק במובייל) ואין רכיב ניווט חלופי לדסקטופ עבור עמודי V2 (`/home-v2`, `/family-v2`, `/chores-v2`, `/alerts-v2`, `/settings-v2`). לכן בדסקטופ אין דרך לעבור בין הטאבים.

**הפתרון:** ליצור `TopNavigationV2` — שורת ניווט אופקית בראש העמוד שמופיעה רק בדסקטופ (`hidden md:flex`), עם אותם 5 פריטים של `BottomNavigationV2` (בית / משפחה / משימות / התראות / הגדרות), בעיצוב התואם ל-`v2-dark`. נוסיף אותה ל-5 עמודי ה-V2 (מעל ה-`max-w-lg mx-auto`, אבל בעצם בעיצוב רחב יותר במחשב).

הניווט התחתון יישאר במובייל בלבד כפי שהוא.

## Issue 2 — הורה 2 רואה "צהריים טובים, yariv" במקום שמו

הסיבה: ההזמנה של `yariv@kippyai.com` נוצרה לפני הוספת השדה `invited_name`, ולכן בעת ההצטרפות (`join-family-by-code`) השם נפל ל-fallback של חלק־מקומי של האימייל = "yariv". בנוסף, ייתכן שכבר קיימת שורת `parents` ישנה עם `full_name='yariv'` שעוקפת את ה-upsert.

בנוסף, עבור ההורה הנוכחי (yariv@kippyai.com שהוא במקרה הזה גם המנהל הראשי) — אם הוא מתחבר כהורה רגיל הוא רואה את הפרטים של החשבון שלו, אבל אם נכנסת כ"אמא גאה" וזה מציג "yariv" — סימן שהפרטים של הורה 1 נשמרו ב-parents תחת ה-id של הורה 2 בטעות (או שטעינת השם נשארה במטמון).

**הפתרון:**

1. **תיקון ההזמנה הקיימת ב-DB** — נמלא ידנית את `invited_name` עבור ההזמנה של אמא גאה (לפי מה שהמשתמש הזין כעת), ונעדכן את `parents.full_name` של המשתמש הזה כך שיתאים לשם הנכון.

2. **חיזוק ה-edge function `join-family-by-code`**: 
   - אם `invited_name` ריק, **לא** ליפול לחלק מקומי של האימייל, אלא להחזיר שגיאה ולבקש מהמזמין ליצור קוד חדש עם שם.
   - להבטיח ש-`parents.upsert` משתמש ב-`onConflict: "id"` ובאמת דורס את `full_name` (כבר עושה זאת — נוודא שאין trigger שמתעלם).

3. **חיזוק `HomeGreeting`**: לוודא שהוא טוען את `parents.full_name` עבור `user.id` בלבד (כבר כך). נוסיף לוג לדיבוג, ובמקרה ש-`full_name` מכיל אימייל / מתחיל באותיות שזהות לחלק־מקומי של אימייל אחר — להעדיף `user_metadata.full_name`.

4. **בדיקת אבטחה נוספת**: `getFamilyParentIds` מחזיר ל-co-parent את ה-`owner_id` (יריב), כך שהילדים המוצגים (ירוב, רואי) הם של המשפחה — זו ההתנהגות הנכונה. אין דליפת נתונים בין משפחות; הבעיה היא רק בשם בברכה.

## קבצים שישתנו

- **חדש**: `src/components/TopNavigationV2.tsx`
- **עריכה**: `src/pages/HomeV2.tsx`, `src/pages/FamilyV2.tsx`, `src/pages/ChoresV2.tsx`, `src/pages/AlertsV2.tsx`, `src/pages/SettingsV2.tsx` — הוספת `<TopNavigationV2 />` בראש כל עמוד.
- **עריכה**: `supabase/functions/join-family-by-code/index.ts` — דרישת `invited_name`, ביטול fallback לאימייל.
- **עריכה**: `src/components/home-v2/HomeGreeting.tsx` — שיפור עדיפות מקור השם.
- **מיגרציה**: עדכון ידני של `family_members.invited_name` ושל `parents.full_name` עבור המשתמשים הקיימים שנפגעו (אמא גאה / yariv).
