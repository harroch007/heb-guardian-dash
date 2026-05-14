## RPC חדש: `get_device_lock_state`

יצירת פונקציית RPC שתאפשר לאנדרואיד לשלוף את מצב הנעילה של הילד דרך 2-Tier Auth Gate (זהה ל-`get_child_chores`), עוקפת את חסימת ה-RLS על קריאה ישירה מהטבלה.

### הפונקציה

```sql
CREATE OR REPLACE FUNCTION public.get_device_lock_state(
  p_child_id uuid,
  p_device_id text DEFAULT NULL
)
RETURNS SETOF public.device_lock_state
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid uuid;
  v_jwt_device_child uuid;
  v_legacy_child uuid;
  v_authorized boolean := false;
BEGIN
  v_caller_uid := auth.uid();

  -- Tier 1: JWT-based auth (modern device or parent)
  IF v_caller_uid IS NOT NULL
     AND v_caller_uid <> '00000000-0000-0000-0000-000000000000'::uuid THEN

    BEGIN
      v_jwt_device_child := NULLIF(
        (auth.jwt() -> 'app_metadata' ->> 'child_id'), ''
      )::uuid;
    EXCEPTION WHEN others THEN
      v_jwt_device_child := NULL;
    END;

    IF v_jwt_device_child IS NOT NULL THEN
      IF v_jwt_device_child = p_child_id THEN
        v_authorized := true;
      END IF;
    ELSE
      -- Parent path
      IF EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.id = p_child_id
          AND c.parent_id = v_caller_uid
      ) THEN
        v_authorized := true;
      END IF;
    END IF;
  END IF;

  -- Tier 2: Legacy device_id fallback
  IF NOT v_authorized AND p_device_id IS NOT NULL THEN
    v_legacy_child := public.authorize_device_call(p_device_id);
    IF v_legacy_child = p_child_id THEN
      v_authorized := true;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT *
    FROM public.device_lock_state
    WHERE child_id = p_child_id
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_device_lock_state(uuid, text)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
```

### למה `RETURNS SETOF` ולא JSON

תואם בדיוק לדפוס של `get_child_chores`, מאפשר לקליינט לפענח את הרשומה ישירות בלי `JSON.parse`, ושומר על טייפים מלאים ב-`types.ts`. במקרה של אין נעילה — חוזר 0 שורות (לא שגיאה).

### אבטחה

- **Tier 1 (JWT)**: מכשיר אנדרואיד מודרני עם `app_metadata.child_id` → חייב להתאים ל-`p_child_id`. הורה מחובר → חייב להיות `parent_id` של הילד.
- **Tier 2 (Legacy)**: `p_device_id` מועבר ל-`authorize_device_call` שמחזיר את ה-`child_id` המוקצה ל-device_id ההוא — חייב להתאים.
- בכישלון בשני השכבות → `42501 UNAUTHORIZED`.

### לאחר ההחלה

`NOTIFY pgrst, 'reload schema'` כדי שה-PostgREST יזהה את ה-RPC החדש מיידית. סוכן האנדרואיד יחליף את ה-`select` הישיר מ-`device_lock_state` בקריאה ל-`rpc('get_device_lock_state', { p_child_id, p_device_id })`.
