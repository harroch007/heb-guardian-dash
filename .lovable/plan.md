הסרת בלוק "משימות מהירות" מתוך אקורדיון "הוסף משימה חדשה" בעמוד `src/pages/ChoresV2.tsx`, כך שהוא יופיע רק בכרטיסה החיצונית מעל האקורדיון.

## שינוי טכני
בקובץ `src/pages/ChoresV2.tsx`, בתוך `AccordionItem value="add-task"` → `AccordionContent`, להסיר את רכיב `<QuickChoreTemplates ... />` ולהשאיר רק את `<ChoreForm onSubmit={addChore} />`.