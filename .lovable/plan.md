## הבעיה
הורה שותף שמקבל לינק הצטרפות (`/join-family`) נדרש כיום להזין אימייל + **סיסמה** + קוד OTP. אין לו סיסמה — הוא הוזמן בלינק עם קוד 6 ספרות בלבד. כתוצאה מכך הוא נתקע ב"Invalid code or email".

## המטרה
מסך הצטרפות פשוט: ההורה השני מזין רק **אימייל** (זה שההורה הראשי הזמין) + **קוד 6 ספרות**, ונכנס אוטומטית למערכת כהורה שותף — בלי סיסמה, בלי OTP, בלי מייל אישור.

## השינויים

### 1. Edge Function חדשה: `join-family-by-code`
קובץ: `supabase/functions/join-family-by-code/index.ts` (+ רישום ב-`supabase/config.toml` עם `verify_jwt = false`).

הזרימה (עם service role):
1. מקבלת `{ email, code }`.
2. מאמתת מול `family_members`: שורה עם `lower(invited_email)=email`, `pairing_code=code`, `status='pending'`, `revoked_at IS NULL`, ו-`pairing_code_expires_at > now()`. אם לא נמצא → `INVALID_CODE_OR_EMAIL`.
3. אם `WAITLIST_MODE` פעיל — מוסיפה אוטומטית את האימייל ל-`allowed_emails` (כי ההורה הראשי הזמין אותו במפורש, זה השער לעקיפת רשימת ההמתנה ללגיטימית).
4. בודקת אם המשתמש קיים ב-`auth.users`:
   - **לא קיים** → יוצרת משתמש חדש עם `auth.admin.createUser` (`email_confirm: true`, סיסמה אקראית פנימית).
   - **קיים** → מאפסת לו סיסמה זמנית חד-פעמית עם `auth.admin.updateUserById`.
5. מחזירה ללקוח `{ email, one_time_password }` — סיסמה זמנית שמשמשת רק לכניסה מיידית בצד הלקוח.
6. הלקוח מבצע `signInWithPassword` ואז קורא ל-RPC `claim_family_invite_by_code` (כמו היום), שמשייך את `member_id` לחשבון ומסמן `accepted`.

הערה אבטחתית: הסיסמה הזמנית נחשפת רק אחרי אימות מוצלח של קוד 6 ספרות עם תפוגה — אותו רף אבטחה כמו OTP. אחרי השימוש החד-פעמי המשתמש מקבל פרופיל רגיל.

### 2. RPC `claim_family_invite_by_code` — תיקון קטן
כיום הוא דורש שהאימייל ב-`auth.users` יהיה זהה לאימייל בקריאה. נשאיר את הבדיקה (כי זה תקין — המשתמש כבר מחובר עם אותו אימייל). לא צריך לשנות.

### 3. עדכון `src/pages/JoinFamily.tsx`
- **הסרת שדה הסיסמה לחלוטין**.
- שני שדות בלבד: אימייל + קוד 6 ספרות.
- במקום `signInWithPassword`/`signUp` ידני — קריאה ל-`supabase.functions.invoke('join-family-by-code', { body: { email, code } })`, ואז `signInWithPassword` עם הסיסמה החד-פעמית שהוחזרה, ואז `claim_family_invite_by_code`.
- אם המשתמש כבר מחובר עם אותו אימייל → דילוג על שלב הכניסה, קריאה ישירה ל-RPC.
- ניווט ל-`/home-v2` בסיום + טוסט "הצטרפת למשפחה!".
- הודעות שגיאה בעברית: קוד שגוי / קוד פג תוקף / לא ניתן להצטרף.

### 4. עדכון הודעת ההזמנה ב-WhatsApp (`FamilyV2.tsx`)
שורות 593-598: עדכון הטקסט כך שלא יזכיר סיסמה כלל. ההודעה תכלול: לינק → אימייל → קוד. (כבר ככה היום, אבל נוודא שאין אזכורי סיסמה.)

### 5. Onboarding
ההורה השותף מדלג על onboarding (אין לו ילדים משלו — הוא חבר במשפחה של ההורה הראשי). כבר היום `useFamilyRole` מזהה `co_parent` דרך `family_members`. נוודא ש-`ProtectedRoute` / `Auth.tsx` לא דוחפים אותו ל-`/onboarding` במקרה הזה. אם כן — נוסיף בדיקה: אם המשתמש קיים ב-`family_members` כ-`accepted`, הוא נחשב מצורף וננתב ל-`/home-v2`.

## חוויית משתמש סופית
1. הורה ראשי: לוחץ "שלח להורה דרך WhatsApp" → הודעה עם לינק + אימייל + קוד.
2. הורה שותף: פותח לינק → רואה אימייל + קוד → לוחץ "הצטרף למשפחה" → נכנס מיידית לדשבורד V2 כהורה שותף. בלי סיסמה. בלי OTP. בלי מייל.

## קבצים שיושפעו
- חדש: `supabase/functions/join-family-by-code/index.ts`
- חדש: רישום ב-`supabase/config.toml`
- עריכה: `src/pages/JoinFamily.tsx` (הסרת סיסמה, זרימה חדשה)
- עריכה קלה: `src/pages/FamilyV2.tsx` (טקסט WhatsApp, אם צריך)
- בדיקה: `src/pages/Auth.tsx` / `ProtectedRoute.tsx` שלא ידחפו co-parent ל-onboarding
