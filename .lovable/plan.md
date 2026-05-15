## הבעיה

בדקתי את הזרימה בפועל מול ה‑DB עבור רחלי (ילדה של yarivtm@gmail.com):

- מקום SCHOOL מוגדר (גדעון האוזנר 3, רדיוס 250m), `alert_on_exit=true`, `is_active=true`. ✅
- מיקום נוכחי של המכשיר: `32.1672, 34.8472` (האורנים, כפר שמריהו) — כ‑1.8 ק"מ מבית הספר. ✅ באמת מחוץ לגבול הגזרה.
- בטבלת `alerts` עם `category='geofence'` יש **0 רשומות בכל המערכת אי פעם**. ❌

**הסיבה:** בארכיטקטורה הנוכחית, השרת רק שומר את המיקום (`update_device_location` מעדכן `devices.latitude/longitude`) ומשגר את רשימת `geofence_places` לאנדרואיד דרך `get_device_settings`. הציפייה היא שהאנדרואיד יזהה לבד יציאה/כניסה ויכתוב alert מסוג `geofence` — ואז הטריגר הקיים `on_geofence_alert_insert` שולח Push.

בפועל הקליינט האנדרואיד לא מבצע את הזיהוי הזה (ואסור לנו לגעת בו לפי האילוץ הקבוע). אין שום לוגיקה בצד השרת שמשווה את המיקום לגבולות הגזרה — לכן אף פעם לא נוצרה התראת `geofence`, אין Push, ואין כרטיס בטאב הבית.

## הפתרון — הזזת זיהוי הגאופנס לצד השרת

כל הלוגיקה תרוץ בתוך RPC קיים שכבר נקרא בכל דיווח מיקום מהאנדרואיד (`update_device_location`), כך שלא נדרש שינוי בקליינט.

### 1. טבלת מצב חדשה: `child_place_state`

מעקב inside/outside per (child, place) כדי לזהות *מעבר* ולא להציף בהתראות:
- `child_id`, `place_id` (PK יחד)
- `is_inside boolean`
- `last_transition_at timestamptz`
- `last_alert_at timestamptz`

עם RLS שמאפשר רק SECURITY DEFINER לכתוב.

### 2. פונקציה חדשה: `evaluate_geofences(p_child_id, p_lat, p_lon)`

- שולפת את כל `child_places` הפעילים של הילד.
- מחשבת מרחק (Haversine) לכל מקום.
- קובעת `inside = distance <= radius_meters`.
- משווה ל‑`child_place_state.is_inside` הקיים:
  - **מעבר ל‑outside** ו‑`alert_on_exit=true` → יוצר alert.
  - **מעבר ל‑inside** ו‑`alert_on_enter=true` → יוצר alert.
- מכבד `child_geofence_settings.exit_debounce_seconds` (ברירת מחדל 120) ו‑`schedule_mode/days_of_week/start_time/end_time` כך שב‑MANUAL עם תזמון לא נשלח אם זה מחוץ לחלון.
- מכבד גם `home_exit_alert_enabled` / `school_exit_alert_enabled` הגלובליים.
- שמירת cooldown של 5 דקות בין התראות זהות (`last_alert_at`).

### 3. INSERT לטבלת `alerts`

`category='geofence'`, `child_id`, `device_id`, `parent_message` בעברית (לדוגמה: "רחלי יצאה מאזור בית הספר — מיקום נוכחי: האורנים, כפר שמריהו"), `should_alert=true`, `is_processed=true` (לא דורש AI), `created_at=now()`. הטריגר הקיים `on_geofence_alert_insert` ידאג ל‑Push דרך `send-push-notification`.

### 4. חיבור ב‑`update_device_location`

בסוף הפונקציה הקיימת, אחרי ה‑UPDATE על `devices`, להוסיף קריאה:
```
PERFORM evaluate_geofences(v_child_id, p_lat, p_lon);
```
עטוף ב‑`BEGIN/EXCEPTION WHEN OTHERS` כדי שכשל בגאופנס לא יפיל דיווח מיקום.

### 5. תצוגה בטאב הבית (HomeV2)

יצירת `HomePendingGeofenceAlerts.tsx` בסגנון של `HomePendingTimeRequests.tsx` /  `HomePendingApps.tsx`:
- שואל את 5 ההתראות האחרונות ב‑24 שעות אחרונות עם `category='geofence'` ו‑`acknowledged_at IS NULL` עבור הילדים של ההורה.
- כרטיס אדום עם אייקון `MapPin`, שם הילד, שם המקום, מתי קרה, וכפתור "ראה מפה" שמוביל ל‑`/alerts` או למסך הילד.
- הוספה ל‑`HomeV2.tsx` בסדר עדיפות מעל NewApps (גאופנס הוא בטיחותי/דחוף יותר).
- עדכון `useNavBadgeCounts` כך שגם התראות גאופנס לא מאושרות יספרו ב‑Bottom Nav.

### 6. Bootstrap מצב התחלתי

בהרצה הראשונה אחרי הדפלוי — לפני שיש שורה ב‑`child_place_state`, ה‑RPC יזהה זאת ויאתחל את המצב לפי המיקום הנוכחי **מבלי לשלוח התראה** (כדי לא להציף בהתראה רטרואקטיבית). מההפעלה הבאה והלאה — רק מעברים אמיתיים יוצרים התראה.

עם זאת, במקרה הספציפי של רחלי שכבר מחוץ לגבול הגזרה כשתאתחל — נרצה התראה. לכן בבוטסטרפ הראשון, אם המצב הוא "מחוץ" ו‑`alert_on_exit=true` — נשלח התראה אחת.

## פרטים טכניים נוספים

- הגרלת המיגרציה: יצירת `child_place_state`, RLS דוחה (`USING(false)`), `evaluate_geofences` כ‑`SECURITY DEFINER`, ועדכון `update_device_location` לקרוא לה.
- ה‑Push כבר עובד דרך `on_geofence_alert_insert` הקיים — רק חסר היה מי שיכניס את ה‑alert.
- אין צורך בעריכת קוד אנדרואיד — האנדרואיד ימשיך לקרוא ל‑`update_device_location(p_device_id, lat, lon, address)` בדיוק כמו היום.

## קבצים שיעודכנו / ייווצרו

- מיגרציה חדשה (טבלה + 2 פונקציות + עדכון update_device_location).
- חדש: `src/components/home-v2/HomePendingGeofenceAlerts.tsx`.
- עדכון: `src/pages/HomeV2.tsx` (הוספת הקומפוננטה), `src/hooks/useNavBadgeCounts.ts` (ספירת geofence).
