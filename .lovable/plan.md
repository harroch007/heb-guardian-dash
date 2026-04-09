מסקנה כרגע: הבעיה כבר לא נראית כמו "צריך גרסה חדשה". לפי הממצאים, צריך לבדוק למה קריאת ה-heartbeat החי לא נכתבת בפועל ל-DB של הפרויקט, למרות ש-`update_device_status` כן מצליח.

מה בדקתי

- ב-DB יש למכשיר `9d5a9132b033a86b`:
  - `devices.last_seen = 2026-04-09 09:14:07+00`
  - heartbeat אחרון ב-`device_heartbeats_raw` עדיין מ-`2026-04-03 15:07:00+00`
- כלומר:
  - המסלול של `update_device_status(...)` כן עובד
  - המסלול של `report_device_heartbeat(...)` לא משתקף כרגע בנתונים
- קראתי את קוד הווב:
  - `useChildControls.ts` טוען את מצב ההרשאות דרך `get_child_device_health`
  - `get_child_device_health` מחזיר את ה-heartbeat האחרון מ-`device_heartbeats_raw`
  - `DeviceHealthBanner` מציג `reportedAt` מתוך אותו heartbeat
- לכן הדשבורד של ההורה לא “ממציא” מצב; הוא פשוט מציג את ה-heartbeat האחרון שנשמר.

מה זה אומר בפועל

- אם האנדרואיד באמת שולח heartbeat חי, הוא צריך להופיע ב-`device_heartbeats_raw`.
- כרגע זה לא קורה, או שהוא נשלח לפרויקט/זהות/סשן אחר, או שהקריאה נכשלת לפני/בזמן ה-RPC.

ההשערות הכי סבירות עכשיו

1. האפליקציה מחוברת עם סשן לא נכון

- `report_device_heartbeat` דורש JWT של device user עם:
  - `auth.role() = authenticated`
  - `app_metadata.role = 'device'`
  - `app_metadata.device_id = p_device_id`
- אם במצב הדיבוג באנדרואיד יש session אחר, Parent session, או device user אחר — `update_device_status` וה-heartbeat לא בהכרח ירוצו מאותו הקשר כמו שאתם חושבים.

2. האפליקציה מצביעה לפרויקט Supabase אחר

- אם Android Studio רץ מול env אחר, הוא יכול “לעבוד בלייב” אבל לכתוב למקום אחר.
- זה מסביר היטב מצב שבו אתה רואה לוגים באנדרואיד, אבל אצלנו אין row חדש ב-`device_heartbeats_raw`.

3. הקריאה ל-`reportDeviceHeartbeat` נכשלת בשקט

- למשל:
  - שגיאת auth
  - `DEVICE_ID_MISMATCH`
  - בעיית serialization של JSON
  - קריאת RPC שלא awaited נכון / exception נבלע
- זה מתאים למצב שבו `last_seen` כן זז, אבל heartbeat לא נכתב.

4. נשלח timestamp ישן מהמכשיר

- ה-RPC שומר `coalesce(p_timestamp, now())`, כלומר אם האנדרואיד שולח `timestamp` מפורש והוא ישן, ה-row כן ייכתב אבל עם `reported_at` ישן.
- זה פחות סביר כאן, כי היינו מצפים לפחות לראות rows חדשים/IDs חדשים, אבל בדיווח שראיתי אין סימן לזה עבור המכשיר הזה.

מה הייתי בודק מול סוכן האנדרואיד, בדיוק

1. הוכחת כתיבה אמיתית ל-project הנכון

- מיד אחרי `reportDeviceHeartbeat(...)`, שידפיס:
  - project URL
  - user id של הסשן
  - claims של JWT: `role`, `app_metadata.role`, `app_metadata.device_id`
  - `deviceId` שנשלח ל-RPC
  - `timestamp` שנשלח
  - success/error מלא מה-Supabase client

2. הוכחת RPC אמיתית, לא רק לוג לפני הקריאה

- לא מספיק לוג `"Reporting full heartbeat"`.
- צריך לוג אחרי הקריאה:
  - `reportDeviceHeartbeat success`
  - או `reportDeviceHeartbeat failed: ...`

3. השוואת זהות בין שני המסלולים

- באותו רגע, מאותו worker/run:
  - `update_device_status(...)`
  - `report_device_heartbeat(...)`
- אם הראשון מצליח והשני נכשל, כמעט בטוח שמדובר ב-auth/device-identity mismatch או payload issue.

4. בדיקה שה-device session הוא אכן device-scoped

- בגלל שה-RPC מוקשח, Parent token לא יעבוד.
- צריך לוודא שהמכשיר משתמש ב-session שנוצר אחרי bootstrap של device auth, לא session ישן אחר.

5. בדיקת env

- לוודא שב-debug build ה-`SUPABASE_URL` וה-key מצביעים בדיוק על:
  - project ref: `fsedenvbdpctzoznppwo`

הסבר פשוט למה הדשבורד ממשיך להציג מידע ישן

```text
Android update_device_status  -> מעדכן devices.last_seen
Android report_device_heartbeat -> מוסיף שורה ל-device_heartbeats_raw
get_child_device_health -> קורא heartbeat אחרון בלבד
DeviceHealthBanner -> מציג permissions + reported_at מאותה שורה
```

לכן ייתכן לגמרי המצב הבא:

- "המכשיר מחובר" = נכון
- "כל ההרשאות פעילות" = נכון רק לפי ה-heartbeat האחרון
- "דווח לפני 5 ימים" = גם נכון, כי לא נשמר heartbeat חדש

תוכנית פעולה מומלצת

1. לא להתמקד כרגע בגרסה

- לקבל שזה לא בהכרח issue של build/version.

2. לבקש מהסוכן הוכחה ברמת runtime

- צילום לוגים של:
  - ה-URL של Supabase
  - device JWT claims
  - ה-response המלא מ-`reportDeviceHeartbeat`

3. לבצע heartbeat ידני מיידי

- להפעיל worker או trigger ידני
- ואז לבדוק האם נוצר row חדש למכשיר הזה ב-`device_heartbeats_raw`

4. אם עדיין אין row חדש

- לבדוק אחד משלושה:
  - project mismatch
  - session mismatch
  - RPC failure swallowed

5. שיפור וובי מומלץ בהמשך

- להוסיף בדשבורד הבחנה ברורה בין:
  - "מחובר לשרת" (`last_seen`)
  - "דיווח הרשאות אחרון" (`reportedAt`)
- כך ההורה יבין מיד שהמכשיר אונליין אבל telemetry/heartbeat לא מתעדכן.

פרטים טכניים

- מקור ה-UI:
  - `src/hooks/useChildControls.ts`
  - `supabase/migrations/20260307225538_68c775b7-b33d-429c-ab0e-ab9cf809afc2.sql` (`get_child_device_health`)
- אבטחת heartbeat:
  - `supabase/migrations/20260408201339_c0bf8d89-b5da-40d7-b015-f867fca200ec.sql`
- אבטחת device status:
  - `supabase/migrations/20260407145242_e13a215e-dd30-4926-8ade-653ebd90d6f2.sql`

אם תאשר, בשלב הבא אבנה לך תוכנית בדיקה מאוד ממוקדת לסוכן האנדרואיד: בדיוק אילו 6 שורות לוג להוסיף, מה הוא צריך להדפיס, ואיך נוכל לדעת תוך דקה אם הבעיה היא auth, project, או timestamp.  
  
בנוסף תכתוב לי פרומט מפורט מה אתה רוצה בדיוק שהוסכן של אנדרואיד יחזיר לך כדי להיות בטוח ב100% שאנחנו מטפלים בבעיה הזאת אחת ולתמיד