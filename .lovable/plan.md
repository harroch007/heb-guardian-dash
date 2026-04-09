## אבחון — שתי בעיות נמצאו בלוגים

### בעיה 1 (קריטית): המכשיר לא מאומת

הלוגים מראים שה-Authorization header מכיל את ה-**anon key** — לא device JWT:

```text
Authorization=[Bearer eyJ...anon...]
```

זה אומר שה-device auth bootstrap לא הופעל, או שהסשן לא נשמר/נטען.
כל ה-RPCs המוקשחים (`update_device_status`, `report_device_heartbeat`) חסמו `anon` — גם אם החתימה הייתה נכונה, הקריאה הייתה נדחית.

### בעיה 2 (משנית): חתימת RPC לא תואמת

האנדרואיד שולח `update_device_status(p_battery, p_device_id)` — 2 פרמטרים בלבד.
ב-DB קיימים רק:

- 4 פרמטרים: `(text, integer, double precision, double precision)`
- 6 פרמטרים: `(text, integer, double precision, double precision, text, text)`

אין overload ל-2 פרמטרים, לכן PostgREST מחזיר `PGRST202`.

### מה זה מסביר

- `update_device_status` נכשל → לכן `last_seen` **לא** מתעדכן (מה שראינו ב-DB שכן זז — זה כנראה היה מגרסה ישנה יותר של האפליקציה שעדיין רצה)
- `report_device_heartbeat` כנראה גם נכשל מאותן סיבות (anon + אולי חתימה)
- לא ראינו לוג heartbeat כי אולי הקריאה לא הגיעה בכלל (או שהלוג נחתך)

---

## תוכנית תיקון

### שלב 1: הוראות לסוכן האנדרואיד (אתה מעביר)

**בעיית Auth — עדיפות ראשונה:**

> המכשיר משתמש ב-anon key במקום device session. צריך לוודא שאחרי `bootstrap-device-auth` הסשן נשמר ונטען לפני כל קריאת RPC. בדוק:
>
> 1. האם `bootstrap-device-auth` רץ בהצלחה בעבר? (חפש לוגים של Bootstrap)
> 2. האם הסשן נשמר ב-SessionManager/EncryptedPrefs?
> 3. האם `supabase.auth.currentSessionOrNull()` מחזיר null? (אם כן — זו הבעיה)
> 4. אם הסשן null — צריך להפעיל מחדש את ה-bootstrap flow

**בעיית חתימה — עדיפות שנייה:**

> `updateStatus` שולח רק `p_battery` ו-`p_device_id`. צריך לשלוח גם `p_lat` ו-`p_lon` (אפילו כ-null). החתימה המינימלית היא 4 פרמטרים.

### שלב 2: תיקון בצד שרת (אופציונלי, כגיבוי)

אם רוצים תמיכה זמנית ב-2 פרמטרים כדי שגרסאות ישנות לא ישברו, אני יכול ליצור migration שמוסיף overload ל-2 פרמטרים שמעביר null ל-lat/lon. אבל זה לא יפתור את בעיית ה-auth — חובה לתקן את ה-bootstrap בצד האנדרואיד.

---

## פרומפט מוכן לסוכן האנדרואיד

```text
שתי בעיות נמצאו:

1. AUTH: המכשיר קורא ל-RPCs עם anon key במקום device JWT.
   - כל ה-RPCs המוקשחים (update_device_status, report_device_heartbeat) 
     חסומים ל-anon.
   - בדוק למה supabase.auth.currentSessionOrNull() מחזיר null.
   - אם ה-bootstrap רץ בעבר אבל הסשן לא נשמר — תקן את שמירת הסשן.
   - אם ה-bootstrap לא רץ — הפעל אותו.
   - אחרי תיקון, הדפס שוב את הלוג KIPPY_DEBUG IDENTITY ווודא 
     שמופיע role=device ו-device_id=9d5a9132b033a86b.

2. SIGNATURE: updateStatus שולח 2 פרמטרים (p_battery, p_device_id).
   הפונקציה בשרת מצפה ל-4 לפחות:
   (p_device_id text, p_battery integer, p_lat double precision, p_lon double precision)
   - הוסף p_lat ו-p_lon לקריאה (אפשר null אם אין מיקום).
   - סדר הפרמטרים: p_device_id, p_battery, p_lat, p_lon.

תיקון 1 (auth) הוא קריטי. בלעדיו שום RPC לא יעבוד.
תיקון 2 (signature) הוא חובה כדי שהקריאה תתאים לחתימה בשרת.
```

### פרטים טכניים

- Migration שהגדיר את ה-overloads: `20260407145242_e13a215e-dd30-4926-8ade-653ebd90d6f2.sql`
- ה-REVOKE מ-anon נעשה בשלב 3 של אותו migration
- ה-bootstrap edge function: `supabase/functions/bootstrap-device-auth/index.ts`  
  
  
`נתתי לו לבצע, אתה תבצע רק את החלק שלך ואשלח לך את מה שביצע` 