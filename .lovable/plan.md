## מטרה
להסתיר את כל הקשר לצ'אט מהממשק של ההורה (טאב, נתיב, באדג' של הודעות לא נקראות), בלי למחוק קוד או נתונים. ניתן יהיה להחזיר בעתיד עם הפעלה של דגל אחד.

## שינויים

1. **`src/config/featureFlags.ts`** — להוסיף דגל חדש:
   ```ts
   export const CHAT_ENABLED = false;
   ```

2. **`src/components/BottomNavigationV2.tsx`** — לסנן את פריט הצ'אט כשהדגל כבוי, ולא לקרוא ל־`useUnreadChatTotal` כשהדגל כבוי (כדי שלא יוצג באדג').

3. **`src/components/TopNavigationV2.tsx`** — לסנן את פריט הצ'אט כשהדגל כבוי.

4. **`src/App.tsx`** — אם יש קישורים נוספים או ראוטים שמובילים ל־`/chat-v2` או `/chat-v2/:friendshipId`, להשאיר את הראוטים פעילים (כדי לא לשבור deep links קיימים אם נכנסים ידנית), אבל אם יש קישור גלוי בתוך ה־Home / Family — להסתיר אותו תחת אותו דגל.

## מה לא משתנה
- הקוד של `ChatV2`, `ChatRoomV2`, `useChat`, `useChatList`, `useUnreadChatTotal` נשאר בדיוק כפי שהוא.
- מסד הנתונים, טבלאות הצ'אט, ה־RPCs וה־Edge Functions — לא נוגעים בהם.
- אפליקציית האנדרואיד — לא נוגעים בה.

## החזרה לפעולה בעתיד
שינוי שורה אחת: `CHAT_ENABLED = true`.
