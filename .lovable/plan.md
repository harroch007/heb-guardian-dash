## הוספת תמיכה בווידאו לצ'אט

### מה משתנה
1. **CHECK constraint** על `chat_messages.message_type` — מוסיפים `'video'` לצד `'text' | 'image' | 'voice'`.
2. **`chat-media` bucket** — מעלים את `file_size_limit` מברירת המחדל ל-100MB (104857600 bytes) כדי לאפשר העלאת קליפי וידאו וקול קצרים.

### SQL

```sql
ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_message_type_check
  CHECK (message_type = ANY (ARRAY['text','image','voice','video']));

UPDATE storage.buckets
  SET file_size_limit = 104857600
  WHERE id = 'chat-media';

NOTIFY pgrst, 'reload schema';
```

### מה לא משתנה
- ה-RPC `send_chat_message` כבר מקבל `p_message_type text` חופשי — לא צריך לשנות אותו.
- ה-RLS על `storage.objects` שכבר נוסף קודם תקף לכל הקבצים ב-`chat-media`, כולל וידאו.
- אין הגבלה על MIME types ב-bucket — כל פורמט וידאו (mp4/mov/webm) יעבור.
- ה-UI הקיים (`useChat.ts`, `ChatRoomV2.tsx`) לא מציג וידאו עדיין — זו עבודה נפרדת לעתיד אם נרצה preview בצד ההורה.

### הודעה לסוכן האנדרואיד
תישלח אוטומטית לאחר ביצוע (כוללת את כל החוזה: Auth, send_chat_message, list_my_chats, Storage paths, ו-video/voice).
