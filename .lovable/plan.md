## הבעיות שזוהו

1. **דליפת נתונים חמורה**: `yariv@kippyai.com` הוא **admin** במערכת. ב-RLS של טבלת `children` קיימת מדיניות `"Admins can view all children" USING (is_admin())` שעוקפת לחלוטין את שיוך המשפחה — לכן ההורה השני ראה את **כל** הילדים בכל המערכת ולא רק של המשפחה שצירפה אותו. זה לא באג של הזרימה החדשה אלא חיתוך לא נכון בין הרשאת admin להרשאת co-parent.
2. **חסר שם להורה השני**: בהזמנה לא נשמר שם → `HomeGreeting` שולף מ-`parents` ולהורה שותף אין רשומה שם → ברכה ללא שם.
3. **אין דרך להפיק קוד חדש לאחר חיבור**: ה-RPC `regenerate_family_invite_code` קיים אבל מסונן ל-`status='pending'` בלבד; אם ההורה כבר חיבר ואז התנתק והקוד נמחק, ההורה הראשי לא יכול להפיק לו קוד חדש.

## השינויים

### 1. תיקון דליפת הנתונים — הפרדה בין "אדמין כלים" ל-"הורה במשפחה" (Backend, RLS)

**ב-V2 (HomeV2 / FamilyV2 / ChildControlV2 / AlertsV2 / SettingsV2 / ChoresV2)** הקריאות ל-`children` יסוננו במפורש לפי המשפחה של המשתמש המחובר, ולא ייסמכו רק על RLS:
- במקום `select * from children` בלבד, נסנן ב-`.or(\`parent_id.eq.${user.id},parent_id.in.(${ownerIds})\`)` כאשר `ownerIds` מגיע מ-`family_members` (owner_id שבהם המשתמש הוא `member_id` עם `status='accepted'`).
- אותו סינון יוחל בכל מקום שמושך `children` במסכי V2.

זה מבטיח שגם משתמש שהוא admin רואה במסך ההורה רק את המשפחה שלו (כלי האדמין הנפרדים תחת `/admin` ימשיכו לעבוד כרגיל דרך RLS).

### 2. הוספת שם להורה השני (Backend + Frontend)

**מיגרציה**:
- הוספת `invited_name text` ל-`family_members`.
- עדכון RPC `create_family_invite_with_code(p_email, p_name)` לקבל ולשמור גם שם.
- עדכון RPC `regenerate_family_invite_code` שלא ייגע בשם.
- עדכון ה-Edge Function `join-family-by-code`: בעת יצירת המשתמש החדש ב-`auth.admin.createUser` להעביר `user_metadata: { full_name: invited_name }`. בנוסף, מיד אחרי הצטרפות, ליצור רשומה ב-`parents` (אם לא קיימת) עם `id = user_id`, `full_name = invited_name`, `email = invited_email`, כך ש-`HomeGreeting` יציג שם נכון.
  - הערה: חשוב להמשיך ולהבחין ב-`useFamilyRole` בין owner ל-co-parent — קיום רשומה ב-`parents` לא ישפיע על זה (הזיהוי הוא דרך `family_members.member_id`).

**Frontend (`FamilyV2.tsx`)**:
- בטופס "הזמן הורה שני" להוסיף שדה חובה "שם ההורה".
- בהודעת WhatsApp להזכיר את השם.
- בתצוגת ההורה השותף הקיים — להציג את השם.

**Frontend (`JoinFamily.tsx`)**: ללא שינוי משמעותי — השם כבר נשמר ב-DB ע"י ה-RPC, ומגיע עם `signInWithPassword`.

### 3. הפקת קוד חדש להורה שכבר התחבר (Backend + Frontend)

- עדכון `regenerate_family_invite_code`: לאפשר גם כאשר `status='accepted'` (או `revoked`). הפעולה תאפס את `member_id`, תחזיר `status='pending'` ותפיק קוד חדש בתוקף 7 ימים. ההורה השני יצטרך להתחבר מחדש דרך `/join-family` ויקבל סשן חדש מבלי שייווצר משתמש כפול (אותו `auth.users` קיים).
- ב-`FamilyV2.tsx`: כפתור "הפק קוד חדש" יוצג גם כשמצב ההורה השני הוא `accepted` (כיום מוצג רק ב-pending).

### 4. ברכה לפי שם ההורה השני

- אחרי שינוי 2, `HomeGreeting` ימשוך את `parents.full_name` של ה-co-parent (כי יצרנו לו רשומה) ויציג "ערב טוב, יריב 👋" כמו לכל הורה.
- לא נדרש שינוי ב-`HomeGreeting.tsx` עצמו.

## חוויית משתמש סופית

- **הורה ראשי**: בטופס ההזמנה מזין שם + אימייל → קבל קוד 6 ספרות + לינק לשליחה ב-WhatsApp.
- **הורה שני**: פותח לינק → מזין אימייל + קוד → נכנס ישר ל-`/home-v2`, רואה ברכה עם שמו, רואה **רק** את ילדי המשפחה שלו, ולא יכול להוסיף/למחוק ילדים (כפי שכבר מוגדר עם `useFamilyRole`).
- **התנתק בטעות?** ההורה הראשי נכנס ל-FamilyV2, לוחץ "הפק קוד חדש", שולח שוב — ההורה השני נכנס שוב מבלי שייווצר חשבון חדש או שיאבד נתונים.
- **בעיית האדמין**: גם אם המשתמש הוא admin של המערכת, במסכי ההורה הוא רואה רק את משפחתו.

## קבצים שיושפעו

- מיגרציה: `family_members.invited_name`, עדכון 2 RPCs.
- עריכה: `supabase/functions/join-family-by-code/index.ts` (יצירת `parents`, העברת שם).
- עריכה: `src/pages/FamilyV2.tsx` (שדה שם, כפתור regenerate ל-accepted, טקסט WhatsApp).
- עריכה: `src/pages/HomeV2.tsx`, `FamilyV2.tsx`, `ChildControlV2.tsx`, `AlertsV2.tsx`, `SettingsV2.tsx`, `ChoresV2.tsx` — סינון `children` מפורש לפי המשפחה (לא להסתמך על RLS בלבד כאשר המשתמש הוא admin).
- עדכון: `claim_family_invite_by_code` נשאר אותו דבר.
