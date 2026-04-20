

# הוספת ילד שני "רואי" לחשבון yarivtm@gmail.com עם נתונים מציאותיים

## מה אעשה

1. **אאתר את ה-parent_id** של `yarivtm@gmail.com` בטבלת `parents`.
2. **אכניס ילד חדש** לטבלת `children`:
   - `name`: רואי
   - `gender`: male
   - `date_of_birth`: ~2013-05-14 (גיל 11)
   - `phone_number`: מחרוזת ריקה (כמו ב-`AddChildModal`)
   - `subscription_tier`: free
3. **אייצר נתונים מציאותיים** סביב הילד כדי שהדשבורד יראה משהו אמיתי:
   - **`devices`** — רשומת מכשיר מקושרת ל-`child_id` של רואי, עם `last_seen` עדכני, סוללה, מיקום (תל אביב), דגם Samsung Galaxy A54
   - **`app_usage`** — שימוש להיום (Asia/Jerusalem) עבור ~5 אפליקציות נפוצות (YouTube, Instagram, WhatsApp, Chrome, TikTok) עם דקות הגיוניות
   - **`app_policies`** — כמה אפליקציות מאושרות + 1-2 חסומות + always_allowed לטלפון/הודעות
   - **`chores`** — 2-3 משימות (אחת pending, אחת completed_by_child ממתינה לאישור, אחת approved)
   - **`bonus_time_grants`** — מענק בונוס קטן להיום
   - **`child_geofence_settings`** — שורה בסיסית עם ברירות מחדל
   - **`child_places`** — מקום "בית" אחד עם רדיוס 150m

## למה זה חשוב
המשתמש נמצא ב-`/home-v2` ורוצה לראות **איך נראה דשבורד עם 2 ילדים** — כלומר ה-`HomeV2` יציג עכשיו 2 כרטיסי ילד (`ChildCardV2`), ובאר ה-`AttentionSection` ו-`DailyControlSummary` יציגו אגרגציה אמיתית משני הילדים.

## טכניקה
- שימוש ב-migration אחד (transactional) שמכיל את כל ה-INSERTs.
- כל ה-INSERTs מותנים ב-`SELECT id FROM parents WHERE ...` כדי לוודא שזה הולך לחשבון הנכון.
- `device_id` יהיה מחרוזת ייחודית `roi-demo-device-{random}`.
- כל הנתונים יסומנו עם `created_at` של עכשיו, ו-usage_date/grant_date של היום ב-Asia/Jerusalem.

## מה לא אעשה
- לא אגע ב-`alerts` (לפי החוק — אין מחיקה/יצירה של dummy alerts).
- לא אכניס נתונים היסטוריים ל-7 ימים אחורה — רק להיום, מספיק כדי שהמסכים יראו תוכן.
- לא אגע בילד הקיים.

## אישור
לאחר שתאשר, אריץ migration אחד שיוסיף את רואי + כל הנתונים המקושרים. תוכל לראות מיד ב-`/home-v2` את הכרטיס הנוסף.

