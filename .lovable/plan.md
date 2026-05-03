# צ'אט אוניברסלי ב-Kippy — תוכנית מלאה

## העיקרון המרכזי

**משתמש אחד = פרופיל אחד בצ'אט**, לא משנה אם הוא הורה או ילד. הורה יכול להתכתב עם:

- הילד שלו
- ילד של הורה אחר
- הורה אחר (חבר משפחה / קרוב משפחה)
- קבוצה של מספר משתתפים (עתידי)

זה אותו הצ'אט בדיוק שיש היום לילדים — אותן טבלאות, אותן הודעות, אותם פיצ'רים (טקסט, תמונות, view-once, TTL 30 יום, real-time). פשוט מרחיבים את ה"מי יכול להיות שולח/מקבל" מ-`child` בלבד ל-`child OR parent`.

## שינוי מודל הנתונים — `chat_participants`

הצ'אט הקיים מניח ששני הצדדים הם `children` (FK בטבלת `friendships` ובעמודה `sender_id` של `chat_messages`). זה לא יחזיק כשגם הורה צריך להיות משתתף.

הפתרון: מוסיפים שכבת אבסטרקציה דקה — `chat_participants` view/table שמאחדת ילדים והורים תחת זהות אחת.

```text
chat_participants (VIEW)
 ├── participant_id (uuid, unique)        ← child.id או parent.id
 ├── participant_type ('child' | 'parent')
 ├── display_name
 ├── owner_parent_id                      ← לילד: parent_id, להורה: עצמו
 └── ...
```

ואז:

- `friendships.requester_id` / `receiver_id` → מצביעים ל-`participant_id` (ללא FK קשיח כי זה union של שתי טבלאות)
- `chat_messages.sender_id` → אותו דבר
- מסירים את ה-FKs הקיימים ל-`children`, מחליפים ב-trigger validation שמוודא שה-id קיים או ב-`children` או ב-`parents`.

## RLS חדש (קריטי)

הפוליסות הקיימות מבוססות על `is_child_of_calling_device` — זה עובד רק לאנדרואיד עם device JWT. צריך פוליסות מקבילות להורה:

- **קריאה**: משתמש רשאי לקרוא הודעות בצ'אט אם הוא משתתף (כילד דרך device_id, או כהורה דרך `auth.uid()` שתואם `parents.id`, או כהורה של ילד שמשתתף — לצורך פיקוח, אופציונלי).
- **כתיבה**: רק אם הוא עצמו ה-sender ומשתתף בצ'אט.

נוסיף helper functions:

- `is_participant_in_friendship(participant_id, friendship_id)` 
- `can_act_as_participant(participant_id)` — בודק או device_id JWT (לילד) או auth.uid (להורה)

## אוטו-חברות הורה↔ילד

טריגר `AFTER INSERT ON children`:

- יוצר אוטומטית `friendship` עם `status='accepted'` בין `parent_id` ל-`child.id`.
- ככה ברגע שהורה מוסיף ילד — הילד מופיע מיד ברשימת הצ'אטים שלו, ולהפך באפליקציית האנדרואיד.
- אידמפוטנטי: `ON CONFLICT DO NOTHING` (נוסיף unique index על זוג).

migration נוסף: backfill לכל הילדים הקיימים — יצירת friendship עם ההורה שלהם.

## צד הורה (Web) — טאב חדש "צ'אט"

### ניווט

מוסיפים פריט חדש ב-`BottomNavigationV2`:

```
{ title: "צ'אט", url: "/chat-v2", icon: MessageCircle }
```

סדר: בית · משפחה · **צ'אט** · משימות · התראות · הגדרות (6 פריטים — נצמצם פדינג כדי שיכנס במובייל, או נכניס את "התראות" לאייקון בלבד).

### דפים חדשים

`**/chat-v2**` — רשימת צ'אטים

- שולפת את כל ה-friendships שבהם ההורה משתתף (כ-`participant`).
- כל שורה: שם המשתתף השני, ההודעה האחרונה, חותמת זמן, badge של "לא נקרא".
- כפתור "+" לפתיחת חיפוש משתמש להוספה (V2 — V1 רק רואים חברויות אוטומטיות).

`**/chat-v2/:friendshipId**` — חלון צ'אט

- בועות הודעות RTL, הודעות שלי משמאל/מימין לפי כיוון.
- input עם: טקסט, צירוף תמונה, כפתור view-once.
- Realtime subscription על `chat_messages` לפי `friendship_id`.
- מתחת — אותה התנהגות בדיוק כמו האפליקציה: view-once נמחק אחרי צפייה, TTL 30 יום ע"י `purge_expired_chat_messages`.

### Hooks

- `useChatList()` — שולף friendships + last_message + unread_count (RPC).
- `useChat(friendshipId)` — הודעות + realtime + send.
- `useUploadChatMedia()` — מעלה ל-bucket קיים.

## צד הילד (אנדרואיד)

**אפס שינויי קוד באנדרואיד.** הקוד הקיים שלהם:

- שולף `friendships WHERE requester_id = me OR receiver_id = me` — אוטומטית יחזיר גם את החברות עם ההורה (כי ההורה הוא `participant_id` תקני).
- שולח/מקבל `chat_messages` — אותו פרוטוקול.

הילד פשוט יראה צ'אט חדש בשם "אבא" / "אמא" (לפי `display_name` של ההורה) — בדיוק כמו עוד חבר.

זה תואם לאילוץ הקריטי **No Android Access**.

## פיצ'רים ב-V1

מתוך התשובה שלך — "בדיוק מה שעשינו בצאט של הילד". כלומר:

- ✅ טקסט
- ✅ תמונות
- ✅ view-once
- ✅ TTL 30 יום
- ✅ Realtime
- ✅ אינדיקציית "נקרא" (אם קיים בילדים — לבדוק)

## סיכון וטיפול


| סיכון                                           | מיטיגציה                                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| RLS recursion בין `children` ל-`participants`   | משתמשים ב-SECURITY DEFINER helpers (תואם memory rule)                                   |
| FK שבירה ב-`chat_messages.sender_id → children` | drop FK, מחליפים ב-trigger validation                                                   |
| הילד באנדרואיד יראה את ההורה ויתבלבל            | `display_name` יהיה "אבא"/"אמא" עם אייקון/קידומת ברורה                                  |
| הורה מציץ בכל הצ'אטים של הילד                   | RLS יאפשר להורה לקרוא רק צ'אטים שהוא בעצמו משתתף בהם. צ'אט ילד↔חבר נשאר חסום (כמו היום) |
| צפיפות ב-BottomNav של מובייל                    | שינוי ל-icon-only בפריטים פחות מרכזיים, או צמצום padding                                |


## פירוט טכני (לקוראים טכניים)

### Migration A — Schema

1. `CREATE VIEW chat_participants` (UNION של children + parents).
2. `ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_sender_id_fkey`.
3. `ALTER TABLE friendships DROP CONSTRAINT friendships_*_id_fkey` (שניהם).
4. טריגר `validate_chat_participant_exists` על INSERT/UPDATE לשתי הטבלאות.
5. Helpers: `is_participant_in_friendship`, `can_act_as_participant`.

### Migration B — RLS

- DROP פוליסות `Child device can ...` הקיימות.
- CREATE פוליסות חדשות `Participant can read/insert chat messages` שמכסות גם device JWT וגם auth user.

### Migration C — Auto-friendship trigger

- `AFTER INSERT ON children` → upsert friendship(parent_id, child.id, 'accepted').
- Backfill לכל ה-children הקיימים.

### Migration D — Realtime

- `ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages, friendships` (אם לא כבר).
- `REPLICA IDENTITY FULL` לשתיהן.

### קוד Web

- `src/pages/ChatV2.tsx` (רשימה)
- `src/pages/ChatRoomV2.tsx` (חלון)
- `src/components/chat/ChatBubble.tsx`, `ChatInput.tsx`, `MediaViewer.tsx`
- `src/hooks/useChat.ts`, `useChatList.ts`
- routing ב-`App.tsx`
- עדכון `BottomNavigationV2.tsx`

## מה לא בתוכנית הזו (נשמור ל-V2)

- חיפוש משתמשים והוספת חברים ידנית (V1 רק חברויות אוטומטיות הורה↔ילד שלו).
- צ'אטים קבוצתיים.
- שיחות קוליות/וידאו.
- העברת הודעות.

---

**שאלה אחרונה לפני יציאה לדרך:** האם להמשיך לתחזק את ה-edge function `seed-mock-peer` (המשתמש "דני") שכבר נפרס, או למחוק אותו כי הוא מיותר עם הגישה הזו?  
  
הוא מיותר אפשר לעזוב את זה 

&nbsp;