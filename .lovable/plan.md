## הבעיה
מסכי הצ'אט (`ChatV2`, `ChatRoomV2`) נבנו בעיצוב מובייל בלבד — במסך גדול הם נמתחים על כל הרוחב ונראים שבורים.

## הפתרון
לעטוף את התוכן בקונטיינר ממורכז עם רוחב מקסימלי (כמו WhatsApp Web — בועת מובייל ממורכזת על רקע כהה), כך שעל מסך גדול הצ'אט מופיע כעמודה צרה ממורכזת, ועל מובייל נשאר זהה.

### `src/pages/ChatV2.tsx` (רשימת צ'אטים)
- לעטוף את ההדר + הרשימה בתוך `<div className="mx-auto w-full max-w-[560px] md:min-h-screen md:border-x md:border-[#202C33]">`.
- ה-Header נשאר `sticky` בתוך הקונטיינר.

### `src/pages/ChatRoomV2.tsx` (חדר שיחה)
- שינוי המעטפת מ-`flex h-[100dvh] flex-col` ל-מבנה מרכזי:
  - שכבה חיצונית: `flex h-[100dvh] justify-center` עם רקע כהה.
  - שכבה פנימית: `flex h-full w-full max-w-[560px] flex-col md:border-x md:border-[#202C33]` — מכילה Header / רשימת הודעות / Composer.
- כל החלקים הפנימיים (header/messages/composer) נשארים בדיוק כמו שהם.

### `src/components/BottomNavigationV2`
- הוא כבר ממורכז עם max-width משלו (לא לגעת).

## מה לא משתנה
- צבעים, RTL, לוגיקה, hooks, edge functions — כלום.
- חוויית מובייל זהה לחלוטין (max-width 560px לא משפיע מתחת ל-560px).

## בדיקה אחרי הפריסה
- מסך גדול: הצ'אט מוצג כעמודה צרה (~560px) ממורכזת.
- מובייל: ללא שינוי ויזואלי.
