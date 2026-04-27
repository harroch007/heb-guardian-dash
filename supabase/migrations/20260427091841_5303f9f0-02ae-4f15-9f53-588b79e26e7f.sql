-- 1) Add invited_name column
ALTER TABLE public.family_members ADD COLUMN IF NOT EXISTS invited_name text;

-- 2) Update create_family_invite_with_code to accept name
CREATE OR REPLACE FUNCTION public.create_family_invite_with_code(p_email text, p_name text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_code text;
  v_expires_at timestamptz := now() + interval '7 days';
  v_existing record;
  v_invite_id uuid;
BEGIN
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF v_email IS NULL OR v_email = '' OR position('@' in v_email) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_EMAIL');
  END IF;

  IF v_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MISSING_NAME');
  END IF;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  SELECT id, status
    INTO v_existing
  FROM public.family_members
  WHERE owner_id = v_owner_id
    AND lower(invited_email) = v_email
  ORDER BY invited_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.status = 'accepted' THEN
      RETURN jsonb_build_object('success', false, 'error', 'ALREADY_MEMBER');
    ELSIF v_existing.status = 'pending' THEN
      UPDATE public.family_members
         SET pairing_code = v_code,
             pairing_code_expires_at = v_expires_at,
             invited_at = now(),
             invited_name = v_name
       WHERE id = v_existing.id
       RETURNING id INTO v_invite_id;
    ELSIF v_existing.status = 'revoked' THEN
      UPDATE public.family_members
         SET status = 'pending',
             pairing_code = v_code,
             pairing_code_expires_at = v_expires_at,
             revoked_at = NULL,
             accepted_at = NULL,
             member_id = NULL,
             invited_at = now(),
             invited_name = v_name
       WHERE id = v_existing.id
       RETURNING id INTO v_invite_id;
    ELSE
      INSERT INTO public.family_members
        (owner_id, invited_email, invited_name, role, status, pairing_code, pairing_code_expires_at)
      VALUES
        (v_owner_id, v_email, v_name, 'co_parent', 'pending', v_code, v_expires_at)
      RETURNING id INTO v_invite_id;
    END IF;
  ELSE
    INSERT INTO public.family_members
      (owner_id, invited_email, invited_name, role, status, pairing_code, pairing_code_expires_at)
    VALUES
      (v_owner_id, v_email, v_name, 'co_parent', 'pending', v_code, v_expires_at)
    RETURNING id INTO v_invite_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'invite_id', v_invite_id,
    'pairing_code', v_code,
    'expires_at', v_expires_at,
    'invited_email', v_email,
    'invited_name', v_name
  );
END;
$function$;

-- 3) Update regenerate_family_invite_code to also work for accepted (resets membership)
CREATE OR REPLACE FUNCTION public.regenerate_family_invite_code(p_invite_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id UUID := auth.uid();
  v_code TEXT;
  v_expires TIMESTAMPTZ := now() + interval '7 days';
  v_email TEXT;
  v_status TEXT;
BEGIN
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT invited_email, status INTO v_email, v_status
  FROM public.family_members
  WHERE id = p_invite_id
    AND owner_id = v_owner_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  v_code := public._generate_family_pairing_code();

  -- Allow regenerate for pending/accepted/revoked. Reset to pending so the co-parent
  -- must re-authenticate via /join-family; auth.users row is preserved.
  UPDATE public.family_members
  SET pairing_code = v_code,
      pairing_code_expires_at = v_expires,
      status = 'pending',
      member_id = NULL,
      accepted_at = NULL,
      revoked_at = NULL
  WHERE id = p_invite_id;

  RETURN jsonb_build_object(
    'invite_id', p_invite_id,
    'email', v_email,
    'code', v_code,
    'expires_at', v_expires
  );
END;
$function$;