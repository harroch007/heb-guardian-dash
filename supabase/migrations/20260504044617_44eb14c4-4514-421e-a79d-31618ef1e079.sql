ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_message_type_check
  CHECK (message_type = ANY (ARRAY['text'::text, 'image'::text, 'voice'::text, 'video'::text]));

UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE id = 'chat-media';

NOTIFY pgrst, 'reload schema';