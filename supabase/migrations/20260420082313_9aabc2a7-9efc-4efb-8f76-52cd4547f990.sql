-- Add pairing code columns to family_members
ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS pairing_code TEXT,
  ADD COLUMN IF NOT EXISTS pairing_code_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_family_members_pairing_code
  ON public.family_members(pairing_code)
  WHERE pairing_code IS NOT NULL;

-- Helper: generate a 6-digit numeric code
CREATE OR REPLACE FUNCTION public._generate_family_pairing_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_code TEXT;
BEGIN
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  RETURN v_code;
END;
$$;

-- Create invite + return code
CREATE OR REPLACE FUNCTION public.create_family_invite_with_code(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID := auth.uid();
  v_email TEXT := lower(trim(p_email));
  v_code TEXT;
  v_expires TIMESTAMPTZ := now() + interval '7 days';
  v_invite_id UUID;
  v_existing RECORD;
BEGIN
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_email IS NULL OR v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;

  -- Don't invite yourself
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_owner_id AND lower(email) = v_email) THEN
    RAISE EXCEPTION 'Cannot invite yourself';
  END IF;

  -- Check existing pending invite for same email
  SELECT id INTO v_existing
  FROM public.family_members
  WHERE owner_id = v_owner_id
    AND lower(invited_email) = v_email
    AND status = 'pending'
    AND revoked_at IS NULL
  LIMIT 1;

  v_code := public._generate_family_pairing_code();

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.family_members
    SET pairing_code = v_code,
        pairing_code_expires_at = v_expires,
        invited_at = now()
    WHERE id = v_existing.id;
    v_invite_id := v_existing.id;
  ELSE
    INSERT INTO public.family_members (
      owner_id, invited_email, role, status, pairing_code, pairing_code_expires_at
    ) VALUES (
      v_owner_id, v_email, 'co_parent', 'pending', v_code, v_expires
    )
    RETURNING id INTO v_invite_id;
  END IF;

  RETURN jsonb_build_object(
    'invite_id', v_invite_id,
    'email', v_email,
    'code', v_code,
    'expires_at', v_expires
  );
END;
$$;

-- Regenerate code for existing pending invite
CREATE OR REPLACE FUNCTION public.regenerate_family_invite_code(p_invite_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID := auth.uid();
  v_code TEXT;
  v_expires TIMESTAMPTZ := now() + interval '7 days';
  v_email TEXT;
BEGIN
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT invited_email INTO v_email
  FROM public.family_members
  WHERE id = p_invite_id
    AND owner_id = v_owner_id
    AND status = 'pending'
    AND revoked_at IS NULL;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Invite not found or not eligible';
  END IF;

  v_code := public._generate_family_pairing_code();

  UPDATE public.family_members
  SET pairing_code = v_code,
      pairing_code_expires_at = v_expires
  WHERE id = p_invite_id;

  RETURN jsonb_build_object(
    'invite_id', p_invite_id,
    'email', v_email,
    'code', v_code,
    'expires_at', v_expires
  );
END;
$$;

-- Claim invite by email + code
CREATE OR REPLACE FUNCTION public.claim_family_invite_by_code(p_email TEXT, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_email TEXT;
  v_email TEXT := lower(trim(p_email));
  v_code TEXT := trim(p_code);
  v_invite RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = v_user_id;

  IF v_user_email IS NULL OR v_user_email <> v_email THEN
    RAISE EXCEPTION 'Email does not match the signed-in user';
  END IF;

  SELECT * INTO v_invite
  FROM public.family_members
  WHERE lower(invited_email) = v_email
    AND pairing_code = v_code
    AND status = 'pending'
    AND revoked_at IS NULL
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invalid code or email';
  END IF;

  IF v_invite.pairing_code_expires_at IS NOT NULL AND v_invite.pairing_code_expires_at < now() THEN
    RAISE EXCEPTION 'Code expired';
  END IF;

  IF v_invite.owner_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot accept your own invite';
  END IF;

  UPDATE public.family_members
  SET member_id = v_user_id,
      status = 'accepted',
      accepted_at = now(),
      pairing_code = NULL,
      pairing_code_expires_at = NULL
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'invite_id', v_invite.id,
    'owner_id', v_invite.owner_id,
    'status', 'accepted'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_family_invite_with_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_family_invite_code(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_family_invite_by_code(TEXT, TEXT) TO authenticated;