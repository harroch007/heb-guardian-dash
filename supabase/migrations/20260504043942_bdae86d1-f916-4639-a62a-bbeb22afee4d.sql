CREATE POLICY "Participant can read chat media"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'chat-media'
  AND public.is_calling_user_in_friendship(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Participant can update own chat media"
ON storage.objects FOR UPDATE TO anon, authenticated
USING (
  bucket_id = 'chat-media'
  AND public.is_calling_user_in_friendship(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'chat-media'
  AND public.is_calling_user_in_friendship(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Participant can delete chat media"
ON storage.objects FOR DELETE TO anon, authenticated
USING (
  bucket_id = 'chat-media'
  AND public.is_calling_user_in_friendship(((storage.foldername(name))[1])::uuid)
);

NOTIFY pgrst, 'reload schema';