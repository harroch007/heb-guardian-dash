## הבעיה

הסוכן של אנדרואיד מצליח להתחבר (יש לוגי `Login` תקינים — `recover-device-credentials` עובד), אבל ההודעות מהילד לא נשמרות. הסיבה: ה-RLS על `chat_messages` דורש ש-`sender_id = current_chat_participant_id()`, שמחזיר את `child_id` (`c30061e9...`) כשהקורא הוא מכשיר. אנדרואיד שולח `sender_id = auth.uid()` (`f2a4f3fa...`, ה-device user), ולכן ה-INSERT נדחה בשקט. בכל הודעות `chat_messages` הקיימות `sender_id` הוא של ההורה.

## הפתרון

נחשוף RPC אחד שמחשב את ה-sender server-side, ונעדכן את ה-Web parent app להשתמש בו. כך גם האנדרואיד וגם ה-web עוברים דרך אותו נתיב — בלי אפשרות לטעות ב-`sender_id`.

## שלבים

1. **Migration:** יצירת RPC חדש
   - `send_chat_message(p_friendship_id uuid, p_content text, p_message_type text default 'text', p_is_view_once boolean default false) returns uuid`
   - `SECURITY DEFINER`, `search_path = public`.
   - מחשב `v_sender := current_chat_participant_id()`, ובודק `is_caller_in_friendship(p_friendship_id)`.
   - מבצע INSERT ל-`chat_messages` עם `v_sender` ומחזיר את ה-id.
   - `GRANT EXECUTE ... TO authenticated, anon`.
   - `NOTIFY pgrst, 'reload schema'`.

2. **Migration:** RPC עזר `list_my_chats()`
   - מחזיר עבור `current_chat_participant_id()` רשימת `friendship_id`, `peer_id`, `peer_name`, `peer_type`, `last_message`, `last_message_at`, `last_message_type`, `unread_count`.
   - `SECURITY DEFINER`. מאפשר לאנדרואיד לטעון את רשימת הצ'אטים הנכונה גם אם ה-uuid המקומי שלו שגוי.

3. **עדכון `src/hooks/useChat.ts`:**
   - להחליף את ה-`supabase.from("chat_messages").insert(...)` ב-`supabase.rpc("send_chat_message", {...})` בשתי הפונקציות `sendText` ו-`sendImage` (לתמונות, לאחר ה-upload לסטורג').
   - להסיר את ה-`sender_id` מה-payload.

4. **לא נוגעים** ב-`recover-device-credentials` — הוא תקין (אומת מול `auth_logs`).

5. **תיעוד לסוכן האנדרואיד** — הודעה מוכנה לשליחה (למטה).

## פרטים טכניים

- ה-RLS הקיים נשמר כהגנה נוספת. ה-RPC הוא הנתיב המומלץ; INSERT ישיר עדיין יעבוד עבור ההורה (auth.uid = parents.id), אבל לא עבור הילד.
- אין שינוי ב-realtime — הוא ממשיך להאזין ל-INSERTs על `chat_messages`, ולכן כשהילד יצליח לשלוח, ההורה יראה מיידית.
- אין שינוי בסכמה של `chat_messages` ולא נוגעים ב-`devices`/`alerts`.

## הודעה לסוכן האנדרואיד (תישלח לאחר הביצוע)

מצורפת בסוף ההודעה הבאה לאחר אישור.
