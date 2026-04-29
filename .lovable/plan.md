
# שלב 2: צ'אט פנימי ובטוח בין ילדים

המערכת תיבנה על תשתית ה-friendships הקיימת (משלב 1), ותשתמש באותו דפוס אבטחה: `is_child_of_calling_device()` עם JWT של מכשיר האנדרואיד.

## 1. מיגרציית סכמה

### 1.1 טבלה: `chat_messages`
```text
id              uuid PK (gen_random_uuid)
friendship_id   uuid NOT NULL → friendships(id) ON DELETE CASCADE
sender_id       uuid NOT NULL → children(id)    ON DELETE CASCADE
message_type    text NOT NULL CHECK IN ('text','image','voice')
content         text NOT NULL  -- טקסט, או storage path (לא URL)
is_view_once    boolean NOT NULL DEFAULT false
created_at      timestamptz NOT NULL DEFAULT now()
```
- אינדקסים: `(friendship_id, created_at DESC)`, `(sender_id)`, `(created_at)` (לצורך TTL)
- `REPLICA IDENTITY FULL` + הוספה ל-publication `supabase_realtime`
- אילוץ: `message_type='text'` ⇒ `is_view_once=false` (טריגר BEFORE INSERT — view-once רק למדיה)

### 1.2 טבלה: `media_views`
```text
id          uuid PK
message_id  uuid NOT NULL → chat_messages(id) ON DELETE CASCADE
viewer_id   uuid NOT NULL → children(id)
viewed_at   timestamptz NOT NULL DEFAULT now()
UNIQUE (message_id, viewer_id)
```

### 1.3 Storage bucket: `chat-media`
- **Private** (לא public). קבצים נקראים רק דרך RPC ייעודי שמחזיר signed URL לזמן קצר.
- מבנה נתיב: `{friendship_id}/{message_id}.{ext}` — מאפשר מחיקה גורפת ב-cron.
- RLS על `storage.objects` ל-bucket זה: כתיבה רק אם המשתמש הוא child של ה-device, ובעלות על friendship; קריאה ישירה מושבתת (רק דרך RPC).

## 2. מודל הרשאות (RLS)

עוזר חדש (SECURITY DEFINER, STABLE):
```text
is_child_in_friendship(p_child_id uuid, p_friendship_id uuid) → boolean
-- TRUE אם הילד הוא requester או receiver, וה-status='accepted'
```

### `chat_messages`
- **INSERT** (anon + authenticated): מותר רק אם `is_child_of_calling_device(sender_id)` **וגם** `is_child_in_friendship(sender_id, friendship_id)`.
- **SELECT** (anon + authenticated):
  - הילד-מכשיר משתתף ב-friendship (דרך עוזר חדש `is_calling_device_in_friendship(friendship_id)`).
  - **למסרי view-once (image/voice)**: ה-policy מסתיר את `content` לצופה אחרי שצפה — מימוש בפועל דרך RPC (`get_chat_messages`) שמחזיר `content=null` ו-`is_consumed=true` במקום ה-policy לבדה. ה-policy של הטבלה מאפשרת SELECT, וה-RPC הוא שמסנן את התוכן.
  - **השולח רואה תמיד** את מה ששלח.
- **הורה**: SELECT דרך `is_family_parent(sender_id)` — לפי דרישה (להוסיף רק אם המוצר רוצה זאת; לפי הברייף הילד הוא יחיד שצורך — אעדיף **לא** להוסיף הורים לצ'אט בשלב זה כדי לשמר את הפרטיות בין ילדים. אם תרצה לפתוח להורה — נוסיף בנפרד.)
- **UPDATE/DELETE**: אסור (DELETE רק דרך cron service-role).

### `media_views`
- **INSERT** (anon + authenticated): רק אם `is_child_of_calling_device(viewer_id)`, viewer_id ≠ sender_id, וה-message שייך ל-friendship שהילד שותף בו, וההודעה היא `is_view_once=true`.
- **SELECT**: הילד-מכשיר רואה צפיות של הודעות ב-friendships שלו (לסימון UI "נצפה").
- **UPDATE/DELETE**: אסור.

## 3. RPCs ייעודיים (SECURITY DEFINER, search_path=public)

| RPC | תפקיד |
|---|---|
| `send_chat_message(p_sender_id, p_friendship_id, p_message_type, p_content, p_is_view_once)` | ולידציה (חברות accepted, view-once רק למדיה), INSERT, מחזיר `message_id`. |
| `get_chat_thread(p_child_id, p_friendship_id, p_limit, p_before)` | מחזיר הודעות בסדר יורד. עבור view-once שכבר נצפה ע"י המבקש: `content=null, consumed=true`. עבור view-once במדיה: מחזיר `signed_url` קצר-מועד (60s) במקום `content` הגולמי, רק אם טרם נצפה. |
| `mark_media_viewed(p_viewer_id, p_message_id)` | INSERT ל-`media_views` (idempotent דרך UNIQUE). מחזיר `consumed=true`. **לא מוחק את השורה** — המחיקה הפיזית של הקובץ נעשית ב-cron מיידי (ראה §4). |
| `delete_friendship_chat(p_child_id, p_friendship_id)` | מחיקה ידנית של כל ההיסטוריה ב-friendship (אופציונלי, נחמד למוצר). |

כל RPC: `GRANT EXECUTE TO anon, authenticated`.

## 4. השמדה אוטומטית

### 4.1 view-once burn — מיידי
פונקציה `purge_consumed_view_once_media()`:
- מאתרת `chat_messages` שהם `is_view_once=true`, `message_type IN ('image','voice')`, ויש להם רשומה ב-`media_views` שהיא **לא** של השולח.
- מוחקת את הקובץ מ-Storage (`storage.objects` DELETE לפי path), ואז מוחקת את שורת ה-message.
- מופעלת:
  - אחרי `mark_media_viewed` (קריאה פנימית בסוף ה-RPC) — burn מיידי.
  - גם ב-cron כל 5 דקות כגיבוי.

### 4.2 30-day TTL
פונקציה `purge_expired_chat_messages()`:
- בוחרת כל `chat_messages` עם `created_at < now() - interval '30 days'`.
- אוספת paths של מדיה (`message_type IN ('image','voice')`).
- מוחקת מ-`storage.objects` (כולל אובייקטים אורפנים ב-bucket לפי `friendship_id` שכבר נמחק).
- מוחקת את השורות מ-`chat_messages` (cascade ימחק `media_views`).
- pg_cron job: יומי ב-03:00 Asia/Jerusalem.

הרצת ה-cron דרך `cron.schedule` עם `net.http_post` לא נדרשת — המחיקה היא SQL טהור, לכן `cron.schedule` קוראת ישירות ל-SELECT של הפונקציה.

### 4.3 ניקוי אורפנים ב-Storage
ה-cron מוחק גם אובייקטים ב-bucket שאין להם message תואם (הגנה על עלויות).

## 5. Realtime

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_views; -- כדי שהשולח יראה "נצפה"
```
האנדרואיד יסנן בצד-לקוח לפי `friendship_id` של friendships שלו (Realtime + RLS יחד מוודאים שלא יקבל הודעות מ-friendships זרים).

## 6. אבטחה — סיכום שכבות

1. **JWT של device** → `is_child_of_calling_device(sender_id)` בכל RPC.
2. **חברות accepted** → `is_child_in_friendship` נבדק ב-RPC וב-policy של INSERT.
3. **Storage privacy** → bucket פרטי + signed URL בלבד דרך RPC.
4. **View-once** → RPC ממיר תוכן ל-null אחרי צפייה ראשונה, ו-burn מיידי של הקובץ.
5. **TTL 30 יום** → cron עם מחיקה פיזית של DB + Storage.
6. **אין כניסת service_role לקליינט** — כל הפעולות דרך RPC.

## 7. סדר ביצוע

1. מיגרציית סכמה: טבלאות, אינדקסים, אילוצים, REPLICA IDENTITY, publication.
2. יצירת bucket `chat-media` פרטי + RLS על `storage.objects`.
3. פונקציות עזר ו-RPCs.
4. RLS policies על `chat_messages` ו-`media_views`.
5. פונקציות מחיקה + הפעלת `pg_cron`/`pg_net` והגדרת ה-job היומי + job של 5 דקות לבדיקת view-once.
6. בדיקות ידניות (Edge Function tests מתאימים פחות כאן — אעדיף בדיקות SQL ידניות לאחר אישור).

## הערות פתוחות לאישור לפני יישום

- **גישת הורים לצ'אט**: לא נכלל. מתאים לפילוסופיית הפרטיות בין הילדים — אם תרצה שההורה יוכל לראות תקצירים/לוגים של הצ'אט (לא תוכן), נוסיף שכבה נפרדת בעתיד.
- **Storage paths**: הקבצים יעלו דרך הקליינט ישירות ל-bucket (כתיבה לפי RLS) ואז ייקרא `send_chat_message` עם ה-path. חלופה: RPC שמקבל base64 ומעלה בעצמו — פחות יעיל לקבצי וויס/תמונה. מציע את הראשונה.
- אם משלוח view-once **טקסט** רלוונטי בעתיד — נסיר את האילוץ של "view-once רק למדיה".

מאשר ליישם? לאחר אישור איצור את המיגרציה ואת ה-RPCs.
