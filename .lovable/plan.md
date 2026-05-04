## הבעיה

ה-bucket `chat-media` קיים אבל עליו **רק policy אחד מסוג INSERT**, ללא SELECT/UPDATE/DELETE. בנוסף ה-INSERT policy תלוי בפונקציה `is_calling_user_in_friendship` שדורשת שה-JWT של המכשיר יכיל `app_metadata.device_id` — אנחנו רואים ב-`recover-device-credentials` שזה אכן נכתב, וה-friendship `b45c669c…` במצב `accepted` עם `child_id` מתאים ל-device `9d5a9132b033a86b`, אז הבדיקה אמורה לעבור — אבל:

1. אין SELECT policy. ה-Android SDK של Supabase Storage לפעמים מבצע HEAD/SELECT לפני upload (resumable/tus), וזה נדחה בשקט.
2. אין UPDATE policy → upsert/retry נכשלים.
3. ל-bucket אין `file_size_limit` או `allowed_mime_types` (null), אז זה לא בעיית MIME — זה אך ורק RLS.
4. נכון לעכשיו אין שום אובייקט ב-`chat-media` (`storage.objects` ריק), כלומר גם ההורה מהאתר לא העלה בהצלחה — לא רק האנדרואיד.

## הפתרון

מיגרציה אחת שמוסיפה את 3 ה-policies החסרות על `storage.objects` עבור `chat-media`, מותאמות לשני סוגי המשתמשים (הורה דרך `auth.uid()`, ילד דרך JWT של מכשיר):

```sql
-- SELECT: כל משתתף בצ'אט יכול לקרוא את הקבצים בתיקייה של אותו friendship
CREATE POLICY "Participant can read chat media"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'chat-media'
  AND public.is_calling_user_in_friendship(((storage.foldername(name))[1])::uuid)
);

-- UPDATE: לאפשר upsert ע"י המשתתף עצמו
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

-- DELETE: לאפשר ניקוי תמונות "צפייה חד-פעמית"
CREATE POLICY "Participant can delete chat media"
ON storage.objects FOR DELETE TO anon, authenticated
USING (
  bucket_id = 'chat-media'
  AND public.is_calling_user_in_friendship(((storage.foldername(name))[1])::uuid)
);
```

לא משנים את ה-INSERT policy הקיים, לא משנים את ה-bucket, לא נוגעים בסכמות שמורות אחרות.

## פרטים טכניים

- ה-INSERT הקיים כבר מאפשר `anon, authenticated` ובודק שהמעלה הוא משתתף ב-friendship שתואם ל-folder הראשון בנתיב. ה-Android חייב להמשיך להעלות לנתיב `<friendshipId>/<filename>` — זה כבר המוסכמה בקוד הצד-לקוח של ה-web (`useChat.ts → ${friendshipId}/uuid.ext`).
- `is_calling_user_in_friendship` מטפל בשני העולמות: parent דרך `auth.uid() = requester_id/receiver_id`, child דרך `devices.device_id = jwt.app_metadata.device_id`.
- ה-bucket נשאר private. ההורה צופה דרך `createSignedUrl` שלא דורש SELECT policy (רץ עם service role בצד Supabase). אבל לסוכן Android שמשתמש ב-`createSignedUrl` עם Auth-JWT (לא service role) — ה-SELECT policy חיוני.
- אם בעתיד נרצה limits: אפשר להוסיף `file_size_limit` ו-`allowed_mime_types` ל-bucket — לא עושים זאת עכשיו כדי לא לחסום קולי `.m4a` או תמונות שונות.

## הודעה לסוכן האנדרואיד (תישלח לאחר ביצוע)

טיוטה:

> Storage RLS תוקן. ה-bucket `chat-media` קיים, ללא הגבלות MIME/size. נוספו policies ל-SELECT/UPDATE/DELETE בנוסף ל-INSERT הקיים, כולן בודקות שהמשתתף שייך ל-`friendship_id` שמופיע כתיקייה הראשונה בנתיב.
>
> **חובה לעקוב אחר הקונבנציה:** הנתיב חייב להיות `"<friendshipId>/<uuid>.<ext>"` בדיוק. אם תעלו ל-root או לתיקייה אחרת — RLS ידחה.
>
> אחרי ה-upload, המשיכו לקרוא ל-RPC `send_chat_message` עם `p_message_type='image' / 'voice'` ו-`p_content=<אותו path בדיוק>`. ה-RPC כבר פותר את ה-sender_id בעצמו.
>
> לקריאת המדיה: השתמשו ב-`createSignedUrl(path, 3600)` עם ה-Auth-JWT — זה יעבוד עכשיו בזכות ה-SELECT policy.
