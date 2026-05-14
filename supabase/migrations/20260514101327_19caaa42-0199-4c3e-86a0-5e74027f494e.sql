
CREATE OR REPLACE FUNCTION public.get_child_siblings_status(
  p_child_id uuid,
  p_device_id text DEFAULT NULL
)
RETURNS TABLE (
  sibling_id uuid,
  name text,
  gender text,
  streak integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_uid uuid;
  v_jwt_device_child uuid;
  v_legacy_child uuid;
  v_authorized boolean := false;
  v_parent_id uuid;
BEGIN
  v_caller_uid := auth.uid();

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
      IF EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.id = p_child_id
          AND c.parent_id = v_caller_uid
      ) THEN
        v_authorized := true;
      END IF;
    END IF;
  END IF;

  IF NOT v_authorized AND p_device_id IS NOT NULL THEN
    v_legacy_child := public.authorize_device_call(p_device_id);
    IF v_legacy_child = p_child_id THEN
      v_authorized := true;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  -- Find the primary parent of the requesting child
  SELECT c.parent_id INTO v_parent_id
  FROM public.children c
  WHERE c.id = p_child_id;

  IF v_parent_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH family_parents AS (
    SELECT v_parent_id AS pid
    UNION
    -- Co-parents who have accepted into this owner's family
    SELECT fm.member_id AS pid
    FROM public.family_members fm
    WHERE fm.owner_id = v_parent_id
      AND fm.status = 'accepted'
      AND fm.member_id IS NOT NULL
    UNION
    -- Owners that the primary parent has joined as a co-parent
    SELECT fm.owner_id AS pid
    FROM public.family_members fm
    WHERE fm.member_id = v_parent_id
      AND fm.status = 'accepted'
  )
  SELECT
    c.id AS sibling_id,
    c.name,
    c.gender,
    COALESCE(rb.current_streak, 0) AS streak
  FROM public.children c
  LEFT JOIN public.reward_bank rb ON rb.child_id = c.id
  WHERE c.parent_id IN (SELECT pid FROM family_parents)
    AND c.id <> p_child_id
  ORDER BY c.created_at ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_child_siblings_status(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
