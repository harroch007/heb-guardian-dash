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