

# תיקון: הדשבורד מציג מידע ישן למרות שהמכשיר חי לחלוטין

## האבחון המלא — מה באמת קרה

בדקתי את ה-DB ישירות עכשיו:

| בדיקה | תוצאה |
|---|---|
| `last_seen` של המכשיר ב-DB | **2026-04-22 17:42:34** (לפני 7 שניות מהבדיקה) |
| `battery_level` | 100% |
| `latitude/longitude` | מעודכנים (גדעון האוזנר, הרצליה) |
| פקודות `REFRESH_SETTINGS` שיצרת היום | **3 — כולן `COMPLETED`** (17:42:23, 17:42:30, 17:42:45) |
| פקודת `LOCATE_NOW` אחרונה | `COMPLETED` ב-17:41:13 |

**הסוכן עובד מצוין**. הבעיה היא **רק בצד הוובי** — הדשבורד מציג נתונים תקועים מהטעינה הראשונה.

## סיבת השורש

ב-`ChildControlV2.tsx`:
1. שורה 211 — שולף את `device` (כולל `last_seen`) פעם אחת ב-mount.
2. שורה 252 — `setInterval(fetchData, 60_000)` קיים, אבל **לא רץ אם `loading=false` והמרכיב סיים להיטען לפני זמן רב, או אם הטאב היה לא-ממוקד**.
3. שורות 257–265 — יש Realtime subscription על `devices`, אבל הוא תלוי ב-`device?.device_id`. ה-effect מאזין ל-`postgres_changes` אבל **בפועל מעט מעדכוני `last_seen` מגיעים ב-Realtime כי הסוכן עושה upsert ולא always update**, או שה-channel נופל בלי reconnect.
4. אין `visibilitychange` listener — כשחוזרים לטאב אחרי כמה שעות, אין רענון מיידי.

**התוצאה**: ה-state של `device` נתקע על snapshot ישן, גם כש-`refresh_settings` מתבצע בהצלחה.

## מה לתקן

### 1) רענון מיידי כשחוזרים לטאב (`visibilitychange`)
ב-`ChildControlV2.tsx`: להוסיף effect שמאזין ל-`document.visibilitychange` וקורא ל-`fetchData(true)` כשהטאב חוזר להיות גלוי.

### 2) רענון אחרי כל פעולה שמעדכנת הגדרות
ב-`useCommandPolling` עבור `REFRESH_SETTINGS` (אם קיים) — אחרי `COMPLETED` להריץ refetch של ה-device ולא רק של commands. אם אין pollingForRefresh נפרד, להוסיף refetch ל-`device` אחרי `sendRefreshToAllDevices`.

### 3) חיזוק ה-Realtime subscription
- להחליף את ה-channel name ל-stable יותר ולא לעטוף ב-effect שתלוי ב-`device?.device_id` בלבד (זה גורם ל-tear-down/setup מיותר).
- להוסיף `UPDATE`-only filter במקום `*` (יעיל יותר).
- במקרה של disconnection — Supabase Realtime בדרך כלל מחזיר אוטומטית, אבל נוסיף re-subscribe כשהדף חוזר מ-hidden.

### 4) קיצור הפולינג מ-60 שניות ל-30 שניות
זה תואם ל-`mem://features/monitoring/sync-triggers` (Push-to-Refresh עם 30 שניות).

### 5) הוספת אינדיקציה ויזואלית עדינה ל-"מתעדכן..."
טקסט "עודכן לפני X" יוחלף ב-spinner קטן בזמן refetch כדי שהמשתמש יראה שהמערכת חיה.

### 6) באנר מצב Realtime (אופציונלי)
אם ב-30 שניות האחרונות לא הגיע אף עדכון Realtime ויש פקודות `COMPLETED` חדשות — הצגת באנר קטן "לחץ לרענון" שמפעיל `fetchData(true)`.

## קבצים שיעודכנו
- `src/pages/ChildControlV2.tsx` — visibilitychange listener, פולינג מהיר יותר, refetch אחרי REFRESH_SETTINGS, חיזוק realtime subscription.

## מה לא נוגעים
- אין שינוי בסוכן האנדרואיד (אין צורך — הוא עובד מצוין).
- אין שינוי ב-DB / RPC / RLS.
- אין שינוי ב-`useChildControls` (הוא לא שולף את `last_seen` בכלל — זה ב-`ChildControlV2` עצמו).
- אין שינוי ב-V1.

## תוצאה צפויה
- ברגע שהסוכן יסיים `REFRESH_SETTINGS` — ה-`last_seen` יתעדכן בדשבורד תוך פחות מ-30 שניות (במקום אף פעם).
- חזרה לטאב אחרי כמה דקות → רענון מיידי, לא צריך F5.
- "עודכן לפני 1 ימים" יהפוך ל-"עודכן עכשיו" בתוך שניות מרגע שהמכשיר מדווח.

