
## תוכנית עבודה סופית — Universal Chat

הסוכן של אנדרואיד אישר שהכל ישים. ה-UI מוכן, ה-SDK מנהל JWT לבד, deep links נתמכים, וההערכה מצידם 1-2 ימי עבודה אחרי שאני מסיים את הצד שלי. להלן התוכנית המלאה לצד ה-Backend (Supabase + Dashboard).

---

### Phase 1 — Schema & Identity Migration

**1.1 הוספת `kippy_tag` לכל המשתתפים**
- ל-`children.kippy_tag` כבר קיים — נוסיף `UNIQUE` constraint + `NOT NULL` אחרי backfill.
- ל-`parents` נוסיף עמודה חדשה `kippy_tag text UNIQUE`.
- פונקציה `generate_kippy_tag(base_name text)` שמייצרת tag ייחודי בפורמט `@name_xxxx` (4 תווים אקראיים).
- Backfill: לכל ילד/הורה קיים בלי tag — נייצר אוטומטית.
- Trigger על INSERT ל-`children` ו-`parents` שמייצר tag אם חסר.

**1.2 Backfill של `auth_user_id` לכל המכשירים הקיימים**
- Edge Function חד-פעמית `backfill-device-auth-users` שעוברת על כל ה-`devices` עם `auth_user_id = NULL`:
  - יוצרת `auth.users` עם email סינתטי `device-<device_id>@devices.kippy.internal`
  - מגדירה `app_metadata: { device_id, child_id, role: 'device' }`
  - מעדכנת את `devices.auth_user_id`
- מחזירה רשימת `(device_id, email, password)` שצריך להעביר ידנית ל-Android לכל מכשיר קיים בפרודקשן (או דרך command מיוחד שה-Android יקרא ויקבל בחזרה credentials).
- **שאלה לפתור עם Android:** איך מכשירים שכבר מותקנים יקבלו את ה-credentials החדשים. שתי אפשרויות:
  - (א) Edge Function נוספת `recover-device-credentials` שה-Android יקרא פעם אחת עם ה-`device_id` המקומי שלו ויקבל את ה-email/password.
  - (ב) להשאיר את ה-credentials בעמודה זמנית ב-`devices` ולשלוף בקריאה אחת.
- בחירה מומלצת: (א) — נוצרת fallback מסודרת.

**1.3 וידוא ש-`bootstrap-device-auth` הקיים תקין**
- כבר יוצר `auth.users` עם `app_metadata.device_id` ו-`child_id` — תקין.
- נוסיף לוגים מפורטים יותר.

---

### Phase 2 — RLS Simplification

החלפת כל ה-RLS שמשתמש ב-`get_device_id_from_jwt()` ב-`auth.uid()` רגיל:

- **`chat_messages`**:
  - SELECT: `auth.uid() IN (SELECT participant_id FROM chat_participants WHERE friendship_id = chat_messages.friendship_id)`
  - INSERT: `sender_id = auth.uid() AND auth.uid() IN (...participants...)`
- **`chat_read_receipts`**: `participant_id = auth.uid()`
- **`friendships`**: `auth.uid() IN (requester_id, receiver_id)`
- **`view_child_active_chats`**: כבר עם `security_invoker = on` — יעבוד אוטומטית.

נשמור את ה-helpers הישנים (`is_calling_user_participant`, `get_device_id_from_jwt`) כ-backward compat לתקופת מעבר, אך נסמן deprecated.

---

### Phase 3 — Invite Friend Flow

**3.1 טבלה חדשה `chat_invites`**
```
id uuid PK, token text UNIQUE,
inviter_id uuid (auth.uid),
inviter_kippy_tag text,
expires_at timestamptz (now + 7 days),
accepted_at timestamptz NULL,
accepted_by_id uuid NULL,
created_at timestamptz default now()
```
RLS: רק היוצר רואה את ההזמנות שלו; INSERT דרך RPC בלבד.

**3.2 Edge Function `create-chat-invite`**
- Input: אין (לוקח את `auth.uid()` מה-JWT).
- מייצר token (UUID), שומר ב-`chat_invites`.
- מחזיר: `{ token, invite_url: "https://kippyai.com/invite/<token>", share_text: "היי! הזמנתי אותך לקיפי..." }`
- Android יקבל את זה ויפתח Native Share Sheet.

**3.3 Edge Function `accept-chat-invite`**
- Input: `{ token }`, מזהה את `auth.uid()` מה-JWT.
- ולידציה: token קיים, לא expired, לא accepted, ו-acceptor ≠ inviter.
- יוצר `friendship` במצב `accepted` בין `inviter_id` ל-`auth.uid()`.
- יוצר 2 רשומות ב-`chat_participants`.
- מסמן את ה-invite כ-accepted.
- מחזיר: `{ friendship_id, peer_kippy_tag, peer_name }` — Android פותח ישירות את חלון הצ'אט.

**3.4 דף נחיתה `/invite/:token` בדשבורד**
- אם המשתמש פותח את הלינק במחשב/דפדפן (לא דרך deep link): מציג "פתח באפליקציית קיפי" + הוראות.
- אם יש App Links מוגדר נכון — Android יחטוף את הלינק לפני שהדפדפן ייפתח.

**3.5 `assetlinks.json`**
- הקובץ כבר קיים ב-`public/.well-known/assetlinks.json`. נוודא שה-SHA256 של ה-signing key של הפרודקשן מופיע שם. אם חסר — נבקש מ-Android.

---

### Phase 4 — Dashboard UI Updates

- ב-`HomeV2` / `FamilyV2`: להציג את ה-`kippy_tag` של כל ילד (read-only).
- ב-`ChatV2` (הורה): להציג את ה-tag של ה-peer בכותרת.
- כפתור "הזמן חבר" מהדשבורד של ההורה — לא חובה בשלב 1 (האנדרואיד מטפל בילד). אבל אפשר לאפשר להורה ליצור hidden invite לעצמו אם ירצה לצ'וטט עם הורה אחר.

---

### Phase 5 — Validation

- בדיקה שב-`view_child_active_chats` מופיעות שורות לכל ילד מחובר.
- בדיקת Realtime: שליחת הודעה מהורה → הילד מקבל ב-Android.
- בדיקת invite מקצה לקצה: יצירת token → שיתוף ב-WhatsApp → לחיצה במכשיר אחר → פתיחת צ'אט.
- Linter + Security scan אחרי כל המיגרציות.

---

### חוזה API לאנדרואיד (לתת להם בכתב)

```
1. Sign-in (existing devices):
   POST /functions/v1/recover-device-credentials
   Body: { device_id }
   Response: { device_email, device_password }
   → signInWithPassword(email, password)
   → השתמש ב-supabase.auth.currentUserOrNull()?.id כ-sender_id מכאן והלאה

2. Sign-in (new pairing):
   POST /functions/v1/bootstrap-device-auth (קיים, ללא שינוי)

3. Read chats:
   SELECT * FROM view_child_active_chats WHERE peer_id != auth.uid()

4. Send message:
   INSERT INTO chat_messages (friendship_id, sender_id=auth.uid(), content, message_type)

5. Realtime: ללא שינוי (chat_messages filter friendship_id=eq.X)

6. Create invite:
   POST /functions/v1/create-chat-invite
   Response: { invite_url, share_text }
   → Intent.ACTION_SEND עם הטקסט

7. Accept invite (deep link handler):
   POST /functions/v1/accept-chat-invite
   Body: { token }
   Response: { friendship_id, peer_name, peer_kippy_tag }
   → openChatActivity(friendship_id)
```

---

### Order of Execution (מינימום סיכון לפרודקשן)

1. Migration: `kippy_tag` columns + backfill + triggers
2. Edge Function: `recover-device-credentials`
3. Edge Function: `backfill-device-auth-users` (run once, manually)
4. עדכון Android (במקביל): התחלת שימוש ב-`auth.uid()`
5. Migration: RLS חדש על `chat_messages` (PERMISSIVE — שני הסטים יעבדו במקביל לתקופת מעבר)
6. Migration: טבלת `chat_invites` + RLS
7. Edge Functions: `create-chat-invite`, `accept-chat-invite`
8. עדכון Dashboard: הצגת tags + דף `/invite/:token`
9. עדכון Android: invite flow + deep link handler
10. אחרי וידוא יציבות: הסרת ה-RLS הישן וה-helper `get_device_id_from_jwt`

---

### זמן משוער שלי (Backend + Dashboard): כיום שלם
### זמן משוער של אנדרואיד: 1-2 ימים (לדבריהם)
### יכולים לעבוד במקביל אחרי Phase 1-2.

**מאשר התחלת ביצוע?**
