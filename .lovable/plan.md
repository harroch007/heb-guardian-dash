## RPC: `get_child_siblings_status`

מטרה: לאפשר לאפליקציית הילד למשוך את שמות, מגדרים ורצפים (streaks) של האחים שלו במשפחה — כדי להציג באנר תחרות חיובית סמויה.

### חתימה

```sql
get_child_siblings_status(p_child_id uuid, p_device_id text DEFAULT NULL)
RETURNS TABLE (
  sibling_id uuid,
  name text,
  gender text,
  streak integer
)
```

### אבטחה — 2-Tier Auth Gate (זהה ל-`get_child_chores`)

- `SECURITY DEFINER`, `STABLE`, `SET search_path = public`.
- שכבה 1 (JWT): `auth.jwt() -> 'app_metadata' ->> 'child_id'` חייב להיות שווה ל-`p_child_id`.
- שכבה 1b (הורה מחובר): אם אין `child_id` ב-JWT אבל יש `auth.uid()` — הולך ל-`children` ובודק `parent_id = auth.uid()` (כדי שהורה יוכל לבדוק/לדבג).
- שכבה 2 (Legacy device): אם לא אוטוריזציה דרך JWT — `authorize_device_call(p_device_id)` חייב להחזיר את `p_child_id`.
- אחרת: `RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501'`.

### לוגיקת השליפה

1. שליפת `parent_id` של `p_child_id` מ-`children`.
2. הרחבת רשימת ההורים הרלוונטיים גם דרך `family_members` (שותפים co-parent עם `status = 'accepted'`) — כך שאחים חורגים בבית מורחב יופיעו גם הם, בעקביות עם איך ש-`HomeV2` רואה את המשפחה.
3. שליפת כל ה-`children` עם `parent_id IN (אותם הורים)` ו-`id <> p_child_id`.
4. `LEFT JOIN reward_bank rb ON rb.child_id = c.id` כדי להביא `current_streak` (ברירת מחדל `0` אם אין רשומה).
5. החזרה של `id, name, gender, streak` בלבד — ללא טלפון, תאריך לידה, kippy_tag, מנוי וכד'.

### החלת המיגרציה

- `GRANT EXECUTE ... TO anon, authenticated`.
- `NOTIFY pgrst, 'reload schema'`.

### קריאה מצד האנדרואיד

```kotlin
supabase.rpc("get_child_siblings_status", mapOf(
  "p_child_id" to childId,
  "p_device_id" to deviceId  // אופציונלי, עבור legacy
))
```

### קבצים שישתנו

- `supabase/migrations/<timestamp>_create_get_child_siblings_status.sql` — מיגרציה חדשה (קובץ יחיד).
- `src/integrations/supabase/types.ts` — מתעדכן אוטומטית עם חתימת ה-RPC.

ללא שינויי frontend — זה backend-only עבור הצרכן באנדרואיד.
