## הסרת מקטע "משימות ובונוס" מ-ChildControlV2

יש כבר טאב ייעודי ל"משימות" (ChoresV2), והכרטיס הזה רק משכפל מידע. הוא תופס מקום מסך יקר במרכז הבקרה של הילד.

### שינוי בקובץ אחד בלבד

**`src/pages/ChildControlV2.tsx`**

1. למחוק את הבלוק של מקטע 10 (שורות 722–755) — כל ה-Card עם ה-Accordion של "משימות ובונוס".
2. לנקות משתנים/imports שכבר לא בשימוש לאחר ההסרה (אם הם משמשים רק במקטע הזה):
   - `activeChoresCount`, `completedTodayChoresCount`, `rewardBankBalance` (החישובים שלהם וה-state/queries שמזינים אותם).
   - האייקון `ListChecks` (אם לא משמש במקום אחר בקובץ).
   - `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent` — להשאיר רק אם משמשים במקטעים אחרים בקובץ.
   - בדיקה אם יש `useChores`/שאילתות ל-`reward_bank` שאפשר להסיר מהקובץ.

### מה נשאר ללא שינוי

- דף `/chores-v2` והטאב התחתון אליו — ממשיכים לתפקד כרגיל.
- שאר המקטעים ב-ChildControlV2 (מיקום, geofence, הגנה חכמה, device health וכו').
- שום שינוי ב-DB, RPCs, או היגיינת תצוגה אחרת.

### בדיקה

לאחר ההסרה — לוודא שהקובץ עולה ללא TS errors (imports יתומים) ושהדף נטען נקי במכשיר נבחר.