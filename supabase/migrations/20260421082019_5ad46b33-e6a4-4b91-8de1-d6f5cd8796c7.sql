-- 1) Replace unique index to ignore revoked invites
DROP INDEX IF EXISTS public.idx_family_members_owner_email;
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_members_owner_email_active
  ON public.family_members (owner_id, invited_email)
  WHERE status IN ('pending','accepted');

-- 2) Update create_family_invite_with_code RPC with reuse/revive logic
CREATE OR REPLACE FUNCTION public.create_family_invite_with_code(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid := auth.uid();
  v_email text := lower(trim(p_email));
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
             invited_at = now()
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
             invited_at = now()
       WHERE id = v_existing.id
       RETURNING id INTO v_invite_id;
    ELSE
      INSERT INTO public.family_members
        (owner_id, invited_email, role, status, pairing_code, pairing_code_expires_at)
      VALUES
        (v_owner_id, v_email, 'co_parent', 'pending', v_code, v_expires_at)
      RETURNING id INTO v_invite_id;
    END IF;
  ELSE
    INSERT INTO public.family_members
      (owner_id, invited_email, role, status, pairing_code, pairing_code_expires_at)
    VALUES
      (v_owner_id, v_email, 'co_parent', 'pending', v_code, v_expires_at)
    RETURNING id INTO v_invite_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'invite_id', v_invite_id,
    'pairing_code', v_code,
    'expires_at', v_expires_at,
    'invited_email', v_email
  );
END;
$$;