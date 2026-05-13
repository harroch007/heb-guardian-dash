## Goal

Create `get_child_chores(p_child_id uuid)` RPC so the Android device JWT can fetch chores reliably (bypassing RLS via SECURITY DEFINER), using the same 2-tier auth gate already used by `complete_chore` / `report_pending_app`.

## Migration (SQL)

```sql
CREATE OR REPLACE FUNCTION public.get_child_chores(
  p_child_id uuid,
  p_device_id text DEFAULT NULL
)
RETURNS SETOF public.chores
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
  -- Tier 1: JWT-based auth
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL
     AND v_caller_uid <> '00000000-0000-0000-0000-000000000000'::uuid THEN

    -- Device JWT: app_metadata.child_id must match
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
      -- Parent / co-parent JWT: must own/co-parent the child
      IF EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.id = p_child_id
          AND (c.parent_id = v_caller_uid
               OR EXISTS (SELECT 1 FROM public.co_parents cp
                          WHERE cp.child_id = c.id
                            AND cp.co_parent_id = v_caller_uid))
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
    FROM public.chores
    WHERE child_id = p_child_id
      AND status IN ('pending', 'completed_by_child', 'approved')
    ORDER BY created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_child_chores(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_child_chores(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
```

Adjust the co-parent check to whatever existing helper we use if `co_parents` table name differs — I'll verify before applying.

## Why this design

- Mirrors `complete_chore` 2-tier auth (JWT child_id match → legacy `authorize_device_call`).
- Also lets parents call it from web (useful for unified data fetching).
- `SETOF chores` returns the full row shape, so Android can deserialize using the existing `Chore` model.
- Filters to `pending / completed_by_child / approved` per spec (keeps approved for streak math).
- Sorted `created_at DESC`.

## After migration

- No client code changes in this step. The Android agent will switch its `select` to `rpc("get_child_chores", { p_child_id, p_device_id })`.

Confirm to apply.  
  
התכנון מושלם. לוגיקת האבטחה הדו-שכבתית (JWT + Legacy Device ID) היא בדיוק מה שצריך כדי להבטיח תאימות לאחור, והשליפה בעזרת SETOF תאפשר לאנדרואיד לקבל את המערך בדיוק באותו מבנה שהוא מכיר. מאושר לביצוע. אנא החל (Apply) את המיגרציה על מסד הנתונים הראשי והודע לי ברגע שה-RPC באוויר.