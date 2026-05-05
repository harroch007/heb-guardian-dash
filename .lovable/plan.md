## מטרה
שיפור חוויית הצ'אטים: מחיקת שיחה בהחלקה, הבחנה ויזואלית ברורה בין נקרא/לא נקרא, ובאדג' אדום עם מספר הלא-נקראו על טאב "צ'אט" בתחתית.

## 1. מחיקת צ'אט בהחלקה (סגנון WhatsApp)

**מודל נתונים — מחיקה "רכה" פר משתתף**
טבלה חדשה `chat_thread_hides`:
- `friendship_id uuid` (FK)
- `participant_id uuid` (ההורה/ילד שהסתיר)
- `hidden_at timestamptz default now()`
- PK: (friendship_id, participant_id)
- RLS: רק בעל ה-`participant_id` יכול לקרוא/לכתוב.

**התנהגות (כמו WhatsApp):**
- בעת מחיקה — נכתוב/נעדכן `hidden_at = now()`.
- ב-`useChatList` נסנן שיחות שבהן `hidden_at` קיים *והודעה אחרונה ≤ hidden_at*. אם נכנסה הודעה חדשה אחרי המחיקה — השיחה תחזור אוטומטית.
- המחיקה אישית בלבד; אינה משפיעה על הצד השני ואינה מוחקת היסטוריה.

**UI ב-`ChatV2.tsx`:**
- כל שורת צ'אט הופכת ל-swipeable עם רקע אדום + אייקון פח שמתגלה בהחלקה שמאלה (RTL → swipe RTL חושף בצד שמאל).
- מימוש קל באמצעות hook פנימי `useSwipeAction` (touch + mouse drag, threshold ~80px) — בלי תלות חיצונית.
- בהחלקה מלאה או לחיצה על הפח → `confirm` קצר ("למחוק את הצ'אט עם X?") → קריאה ל-RPC `hide_chat_thread(p_friendship_id)`.
- עדכון אופטימי של רשימת הצ'אטים + toast "הצ'אט נמחק".

## 2. הבחנה ברורה בין נקרא ללא-נקרא

ב-`ChatV2.tsx` (כרגע ההפרש דק מדי):
- שיחות עם `unreadCount > 0`:
  - שם הצ'אט במשקל `font-bold` + צבע `#FFFFFF`.
  - תצוגה מקדימה של ההודעה ב-`#E9EDEF` במקום `#8696A0`, וב-`font-medium`.
  - שעה/תאריך בצבע ירוק `#00A884` ובמשקל מודגש.
  - באדג' עגול ירוק עם המספר בצד שמאל של השורה (לא צמוד לאווטאר), בגודל בולט יותר.
  - פס צד דק (border-r 3px ירוק) שמדגיש את כל השורה.
- שיחות שנקראו: כל הצבעים כפי שהם היום (אפור + רגיל).

## 3. נוטיפיקציה אדומה על טאב "צ'אט" בתחתית

**הוק חדש `useUnreadChatTotal`:**
- שולף בצורה זולה את סכום הלא-נקראו של ההורה (משתמש בלוגיקה הקיימת מ-`useChatList` — נחלץ אותה ל-query נפרד שמחזיר רק `total`).
- מאזין ל-realtime על `chat_messages` (INSERT) ועל `chat_read_receipts` (UPSERT) כדי לעדכן מיידית.
- שמור ב-React Query עם key `["unread-chat-total", parentId]` כדי שייקרא פעם אחת ויתחלק בין הקומפוננטות.

**ב-`BottomNavigationV2.tsx`:**
- קריאה ל-`useUnreadChatTotal()`.
- על האייטם "צ'אט": אם `total > 0`, מציג באדג' אדום קטן (`bg-red-500 text-white text-[10px]`) בפינה ימנית-עליונה של האייקון:
  - 1–99 → המספר בדיוק.
  - 100+ → "99+" (לא 142 ממש כדי שלא ישבור פריסה — ניתן להגדיל ל-"999+" אם תעדיף, נא לאשר).
- מיקום: `absolute -top-1 -right-1` על קונטיינר יחסי שעוטף את ה-`<Home/Users/...>` icon.

## פרטים טכניים

**מיגרציה:**
```sql
CREATE TABLE public.chat_thread_hides (
  friendship_id uuid NOT NULL REFERENCES public.friendships(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (friendship_id, participant_id)
);
ALTER TABLE public.chat_thread_hides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own hides"
  ON public.chat_thread_hides FOR ALL
  USING (participant_id = auth.uid())
  WITH CHECK (participant_id = auth.uid());

CREATE OR REPLACE FUNCTION public.hide_chat_thread(p_friendship_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- ensure caller is participant
  IF NOT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE id = p_friendship_id
      AND (requester_id = auth.uid() OR receiver_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  INSERT INTO public.chat_thread_hides (friendship_id, participant_id, hidden_at)
  VALUES (p_friendship_id, auth.uid(), now())
  ON CONFLICT (friendship_id, participant_id)
  DO UPDATE SET hidden_at = EXCLUDED.hidden_at;
END;
$$;
```

**קבצים שיתעדכנו/יווצרו:**
- migration חדשה: טבלה + RPC + RLS.
- `src/hooks/useChatList.ts` — fetch של `chat_thread_hides` וסינון.
- `src/hooks/useUnreadChatTotal.ts` — חדש.
- `src/pages/ChatV2.tsx` — swipe-to-delete, סגנון נקרא/לא-נקרא חזק יותר.
- `src/components/BottomNavigationV2.tsx` — באדג' אדום על "צ'אט".
- (אופציונלי) רכיב פנימי `SwipeableRow` בתוך `ChatV2.tsx`.

## שאלה אחת לפני ביצוע
- במספר 142 הצגתי "99+" כסטנדרט (כמו WhatsApp). אם תעדיף הצגה מלאה (142 ממש) — ציין ואעדכן.
