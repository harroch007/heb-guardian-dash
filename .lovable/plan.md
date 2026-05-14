## חשיפת `child_gender` בזרימת ה-Pairing

המטרה: שהאנדרואיד יקבל את מין הילד (`male`/`female`/`other`) ברגע ההתחברות, כדי להתאים את שפת הממשק.

### מצב קיים
- טבלת `children.gender` כבר קיימת (`text`, ערכים בפועל: `male`, `female`, `other`).
- שתי דרכי pairing באנדרואיד:
  1. `bootstrap-device-auth` (Edge) → מפעיל `pair_device` RPC.
  2. `connect_child_device` RPC ישיר (legacy: email + code).
- שתיהן מחזירות כיום `child_id` ו-`child_name` בלבד.

### שינויים מתוכננים

**1. RPC `pair_device` — מיגרציה**
- `RETURNS TABLE(success, child_id, child_name, child_gender text, error_message)` — מוסיף עמודה.
- שולף `gender` מטבלת `children` יחד עם `id, name`.
- במקרה כישלון: `child_gender` = `null`.

**2. RPC `connect_child_device` — מיגרציה**
- מוסיף `'child_gender', v_child_gender` ל-`json_build_object` של ה-success branch.

**3. Edge Function `bootstrap-device-auth/index.ts`**
- קורא `child_gender` מתוצאת `pair_device`.
- מוסיף ל-JSON response: `child_gender`.
- מוסיף ל-`app_metadata` ול-`user_metadata` של ה-auth user החדש.

**4. Edge Function `recover-device-credentials/index.ts`**
- ה-`select` מ-`children` כבר טוען רק `name` — להרחיב ל-`name, gender`.
- מוסיף `child_gender` ל-`user_metadata` ול-JSON response.

**5. החלת מיגרציה**
- מריץ `NOTIFY pgrst, 'reload schema'` אחרי שינוי החתימות (חתימת `pair_device` משתנה — שינוי breaking לקליינטים שמסתמכים על מבנה ה-TABLE; האנדרואיד הוא הצרכן היחיד).

### ערכים נתמכים
`'male' | 'female' | 'other'` (ללא ברירת מחדל בצד השרת — אם `gender` ריק, יוחזר `null` והאנדרואיד יבחר fallback).

### סיכום נקודות שהאנדרואיד יוכל לקרוא מהן `child_gender`
- `bootstrap-device-auth` JSON response (`child_gender`)
- `recover-device-credentials` JSON response (`child_gender`)
- `pair_device` RPC row (`child_gender`)
- `connect_child_device` RPC json (`child_gender`)
- ב-JWT של המכשיר: `app_metadata.child_gender` (זמין מ-`auth.jwt()` בכל קריאה)
