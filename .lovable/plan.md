

# הסיבה האמיתית — `update_device_status` דורס את הקואורדינטות

## מה מצאתי בקוד ה-RPCs

יש שני RPCs שונים שכותבים לטבלת `devices`:

### 1. `update_device_location(p_device_id, p_lat, p_lon, p_address)`
נקרא רק כשה‑Android הצליח להשיג GPS fix.
```sql
UPDATE devices SET
  latitude = p_lat,
  longitude = p_lon,
  address = COALESCE(p_address, address),
  last_seen = NOW()
WHERE device_id = p_device_id;
```
שים לב: `address` מוגן ב-`COALESCE`, אבל `latitude`/`longitude` **לא**.

### 2. `update_device_status(p_device_id, p_battery, p_lat, p_lon, ...)`  ← **הבעיה כאן**
נקרא הרבה יותר תכופות (heartbeat/סטטוס/סוללה), עם `p_lat DEFAULT NULL` ו-`p_lon DEFAULT NULL`.
```sql
UPDATE public.devices SET
  ...
  latitude  = p_lat,   -- ❌ דורס ב-NULL!
  longitude = p_lon,   -- ❌ דורס ב-NULL!
  ...
WHERE device_id = p_device_id;
```
אין כאן `COALESCE`. ברגע שה-Android שולח עדכון סטטוס בלי קואורדינטות (וזה קורה כל הזמן — סוללה, heartbeat, פתיחת אפליקציה), הפונקציה **מאפסת ב-`NULL` את הקואורדינטות שהיו קיימות**.

`address` שורד כי הוא לא חלק מה-UPDATE הזה — לכן בדיוק רואים `address` תקף עם `lat/lon = null`.

## למה זה תואם בדיוק לדיווח של ה-Android
- ה-Android אמר: כשיש קואורדינטות, הוא תמיד שולח אותן ל-`update_device_location`. ✅
- אבל בין קריאה אחת ל-`update_device_location` לבין הבאה, יש עשרות קריאות ל-`update_device_status` עם `p_lat=null, p_lon=null` (כי זה RPC כללי לסטטוס/סוללה).
- כל אחת מהן מאפסת את הקואורדינטות.
- התוצאה: `lat=null, lon=null, address="גדעון האוזנר, הרצליה"`.

## התיקון

מיגרציה אחת ממוקדת ל-`update_device_status` — להחליף את שתי השורות ל-`COALESCE`:

```sql
UPDATE public.devices SET
  ...
  latitude  = COALESCE(p_lat, latitude),
  longitude = COALESCE(p_lon, longitude),
  ...
WHERE device_id = p_device_id;
```

זה עקבי לחלוטין עם ההתנהגות של `address` באותה טבלה ועם `update_device_location` (ש-Android סומך עליו כמקור האמת למיקום).

## מה לא ייגע
- שום שינוי בקוד Android (אסור)
- שום שינוי בלוגיקת אכיפה (מגבלה יומית, שעת שינה, בית ספר, שבת/חגים)
- שום שינוי ב-`get_device_settings` שתוקן אתמול
- שום שינוי ב-`update_device_location` (כבר תקין)
- שום שינוי במבנה הטבלה
- היסטוריית `devices` נשמרת — `UPDATE` בלבד, בלי `DELETE`

## אימות אחרי התיקון
1. הרצת המיגרציה.
2. בדיקה ב-`devices` ש-`latitude`/`longitude` של "יריב חדש" מתחילים להישמר ולא להתאפס.
3. במכשיר: לחיצה על **"אתר עכשיו"** בכרטיסיית מיקום — אמורה להופיע מפה אמיתית תוך כמה שניות, וגם להישאר נוכחת אחרי heartbeat נוסף.
4. בנוסף, בדיקת smoke ב-DB:
   ```sql
   SELECT device_id, latitude, longitude, address, last_seen
   FROM devices WHERE device_id='9d5a9132b033a86b';
   ```
   מצופה: `latitude`/`longitude` מספריים, לא `null`, ויציבים בין דיווחי heartbeat.

## בונוס (אופציונלי, ממליץ)
אחרי שזה ייוודא — לעדכן את `LocationSectionV2.tsx` כך שגם בתרחיש הקצה (אין `lat/lng` אבל יש `address`) יופיע כפתור "פתח בגוגל מפות" לפי הכתובת. שיפור UI בלבד, לא חובה לתיקון הבאג.

