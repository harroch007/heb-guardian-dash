## הבעיה

1. **כפתור "הזמן חבר" אצל הילד נכשל**: ה-Edge Function `create-chat-invite` קורסת מיד עם `TypeError: supabase.auth.getClaims is not a function`. המתודה הזו פשוט לא קיימת ב-Supabase JS SDK — צריך להחליף ב-`supabase.auth.getUser(jwt)`.
2. **אותה בעיה ב-`accept-chat-invite`** (אותו דפוס קוד) — כשהחבר ילחץ על הקישור גם זה ייכשל.
3. **אין כפתור "הזמן חבר" בהורה** — וזה בכוונה. בארכיטקטורה הנוכחית **רק הילד מזמין חברים**. ההורה הוא צד מקבל בלבד (כשמישהו שולח לו קישור הזמנה).

## מה אעשה

### 1. תקן `supabase/functions/create-chat-invite/index.ts`
החלף:
```ts
const { data: claimsData } = await supabase.auth.getClaims(jwt);
const callerAuthId = claimsData.claims.sub;
```
ב:
```ts
const { data: { user }, error } = await supabase.auth.getUser(jwt);
if (error || !user) return 401;
const callerAuthId = user.id;
```

### 2. תקן `supabase/functions/accept-chat-invite/index.ts`
אותו תיקון בדיוק.

### 3. הוסף לוגים ברורים יותר
כך שאם תהיה תקלה בעתיד נראה מיד את הסיבה האמיתית בלוגים, לא הודעה גנרית.

### 4. הבהרה בצד ההורה (ללא קוד חדש)
לא נוסיף כפתור "הזמן חבר" בדשבורד ההורה — לפי התכנון, ההורה רואה את הצ'אטים שנוצרים אוטומטית כשהילד שלו (או חבר אחר) מתחבר. אם תרצה בהמשך שגם להורה תהיה יכולת ליזום הזמנה לחבר/בן משפחה אחר — נוסיף את זה כפיצ'ר נפרד.

## אחרי הפריסה
- לחיצה על "הזמן חבר" אצל הילד תפתח את WhatsApp עם קישור `kippyai.com/invite/<token>`.
- כשהחבר יפתח את הקישור (מחובר לאפליקציה) — הצ'אט ייווצר אוטומטית.

## שאלה
האם תרצה שגם להורה יהיה כפתור "הזמן בן משפחה / חבר" בנפרד? (לא נדרש לתיקון הנוכחי, אבל אפשר להוסיף אם זה ערך מבחינתך.)