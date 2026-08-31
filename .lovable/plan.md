## מטרה
לתקן את הבנייה השבורה ולאפשר המשך פיתוח.

## הבעיה
קובץ הטיפוסים של Supabase (`src/integrations/supabase/types.ts`) אינו מסונכרן עם הסכמה הנוכחית במסד הנתונים. כתוצאה מכך עשרות קומפוננטות נכשלות בבדיקת TypeScript — בעיקר קריאות ל־`supabase.from("...")` על טבלאות/עמודות שלא קיימות בטיפוסים המג'נרטים (למשל `v2_admin_action_requests`, `ai_model_config`, `customer_groups`, `waitlist_signups` וכו').

## שלבי התיקון

1. **רענון טיפוסי Supabase**
   - הפקת קובץ `types.ts` מחדש על סמך הסכמה העדכנית בפרויקט (supabase gen types typescript).
   - וידוא שהטיפוסים החדשים כוללים את כל הטבלאות והעמודות שמופיעות בשגיאות.

2. **בדיקת בנייה מחודשת**
   - הרצת בדיקת TypeScript (`bunx tsc --noEmit` או tsgo) ווידוא שכל השגיאות הקיימות נעלמו.
   - אם נותרו שגיאות — תיקון קומפוננטות ספציפיות שמפנות לשדות/טבלאות שלא קיימים יותר.

3. **המשך לפי תוכנית הגאופנס (לאחר תיקון הבנייה)**
   - יצירת טבלת `child_place_state` ופונקציית `evaluate_geofences`.
   - חיבור ל־`update_device_location`.
   - הוספת כרטיס גאופנס ב־HomeV2 ועדכון ספירת התראות.

## קבצים מרכזיים
- `src/integrations/supabase/types.ts` — ירונן/יתוקן.
- קומפוננטות שמופיעות בלוג השגיאות (BottomNavigation, ChildCard, EditChildModal, ReconnectChildModal, WaitlistModal, AdminGroupsTab, LostModeSection ועוד) — יבדקו מחדש לאחר רענון הטיפוסים.

## הערות
- אין לערוך את `types.ts` ידנית — הוא נלקח מה־API של Supabase וצריך להתעדכן דרך כלי ההפקה.
- לא ניגע בקוד אנדרואיד (אילוץ קבוע).
