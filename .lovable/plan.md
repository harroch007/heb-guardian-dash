

# תיקון "שלח הזמנה" + סנכרון התסריט המלא של הזמנת הורה שותף

## האם אני מעודכן בתוכנית? — כן, כמעט הכל כבר קיים

הזרימה שתיארת **כבר בנויה במערכת**, רק נשברת בנקודה אחת. זה מה שכבר קיים:

- **`/family-v2`** מאפשר להזין אימייל → הקוד מייצר הזמנה דרך RPC `create_family_invite_with_code`.
- אחרי יצירה מוצגים: **קוד 6 ספרות**, תוקף, וכפתורי **"שלח להורה דרך WhatsApp"**, **"העתק קוד"**, **"העתק קישור"**, **"הפק קוד חדש"**.
- הודעת WhatsApp כוללת היום את הלינק (`/join-family`), הקוד, והאימייל המוזמן.
- **`/join-family`** מציג טופס: אימייל + סיסמה + קוד 6 ספרות → קורא ל‑RPC `claim_family_invite_by_code` → מחבר את ההורה השותף.

## הבאג שגרם לשגיאה אצלך

`duplicate key value violates unique constraint "idx_family_members_owner_email"`

זה אומר שב‑DB יש אינדקס יוניק:
```sql
CREATE UNIQUE INDEX idx_family_members_owner_email
  ON family_members (owner_id, invited_email);
```
ללא תנאי `WHERE status <> 'revoked'`.

מה שקרה: כבר ניסית בעבר להזמין את אותו אימייל (או הזמנה ישנה שבוטלה / לא נוקתה). נשארה שורה לאותו `(owner_id, invited_email)`, וה‑INSERT החדש שב‑`create_family_invite_with_code` נופל על האינדקס. ה‑RPC לא מטפל בזה — אין `ON CONFLICT` ואין reuse.

זה גם הסיבה שהמסך לא עובר אוטומטית למסך הקוד+WhatsApp — ה‑INSERT נופל לפני שמוצגים פרטי ההזמנה.

## הפתרון — שני שינויים בלבד, לא פוגע בשום קוד אנדרואיד / לוגיקת אכיפה

### 1. מיגרציית DB אחת (תיקון `create_family_invite_with_code`)

ב‑RPC `create_family_invite_with_code` להוסיף לוגיקה לפני ה‑INSERT:

- אם קיימת שורה ב‑`family_members` עם אותם `owner_id` + `invited_email`:
  - אם `status = 'pending'` → **עדכון**: ליצור קוד חדש, לאפס `pairing_code_expires_at`, להחזיר את אותו `invite_id`. (אין סיבה ליצור הזמנה כפולה.)
  - אם `status = 'accepted'` → להחזיר שגיאה ברורה: `"הורה זה כבר חבר במשפחה"`.
  - אם `status = 'revoked'` → **תחיה**: `UPDATE` לחזרה ל‑`pending`, קוד חדש, איפוס `revoked_at`.
- רק אם אין שורה כלל → `INSERT` חדש.

מבחינת אינדקס — להחליף את האינדקס היוניק לכזה שמתעלם מ‑`revoked`:
```sql
DROP INDEX IF EXISTS idx_family_members_owner_email;
CREATE UNIQUE INDEX idx_family_members_owner_email_active
  ON public.family_members (owner_id, invited_email)
  WHERE status IN ('pending','accepted');
```
זה שומר על שלמות הנתונים אבל מאפשר להזמין מחדש אחרי revoke.

לא נוגע ב‑`accept_family_invite` / `claim_family_invite_by_code` / `revoke_co_parent` — הם נשארים כמו שהם.

### 2. שיפור הודעת ה‑WhatsApp (קוסמטי)

לוודא שהמלל ברור וכולל בסדר נכון: ברכה → הסבר → לינק → קוד → אימייל. זה כבר כמעט כך — רק תיקון ניסוח קל ב‑`FamilyV2.tsx` (שורות ~573).

```
שלום! הוזמנת להצטרף כהורה שותף ב-KippyAI 👨‍👩‍👧
1) פתח את הקישור: https://<host>/join-family
2) השתמש באימייל: <email>
3) הזן את קוד ההצטרפות: <CODE>
הקוד תקף ל-7 ימים.
```

## מה יקרה אחרי התיקון

1. תזין אימייל → תלחץ "שלח הזמנה".
2. המסך יתחלף מיד למצב "ממתין לאישור" עם:
   - הקוד בן 6 הספרות (גדול ומודגש)
   - תוקף
   - כפתור ירוק **"שלח להורה דרך WhatsApp"** (פותח WhatsApp עם הטקסט המלא כולל הלינק `/join-family`, האימייל והקוד)
   - **"העתק קוד"** / **"העתק קישור"** / **"הפק קוד חדש"** / **"בטל הזמנה"**
3. ההורה השותף נכנס ל‑`/join-family`, מזין אימייל + סיסמה (או נרשם אם חדש) + קוד → מצטרף וזה נסגר אוטומטית במסך שלך (יש כבר Realtime listener שמודיע "ההורה הצטרף!").

## אימות
- חשבון שכבר ניסה להזמין את `yaryar007@gmail.com` → לחיצה על "שלח הזמנה" → אין שגיאה, מופיע מסך הקוד + WhatsApp.
- ביטול הזמנה → הזמנה חדשה לאותו אימייל → עובד.
- אימייל שכבר אושר כשותף → שגיאה ברורה בעברית, לא crash.

## מה לא ייגע
- אין שינוי בקוד Android.
- אין שינוי בלוגיקת אכיפה / settings / get_device_settings.
- אין שינוי ב‑RLS של `children` / `alerts` / `devices`.
- אין מחיקת נתונים בטבלאות חיות.
- אין שינוי ב‑auth / ב‑waitlist mode.

