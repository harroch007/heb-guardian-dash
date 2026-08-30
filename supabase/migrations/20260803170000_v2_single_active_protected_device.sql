-- A child has one canonical protected Android device. Registering a clean
-- installation must revoke every previous live device and its credentials
-- before the new installation becomes active.
CREATE OR REPLACE FUNCTION public.v2_register_device_service(
  actor_user_id uuid,
  target_child_id uuid,
  target_installation_id uuid,
  target_app_version text,
  target_capture_contract_version smallint,
  target_manufacturer text,
  target_model text,
  new_credential_hash text,
  credential_expires_at timestamp with time zone
)
RETURNS TABLE(
  device_id uuid,
  credential_key_version integer,
  credential_expiry timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  target_family_id uuid;
  existing_device public.v2_protected_devices%ROWTYPE;
  resolved_device_id uuid;
  next_key_version integer;
BEGIN
  IF actor_user_id IS NULL
    OR target_child_id IS NULL
    OR target_installation_id IS NULL
    OR char_length(target_app_version) NOT BETWEEN 1 AND 80
    OR target_capture_contract_version < 2
    OR char_length(new_credential_hash) <> 64
    OR credential_expires_at <= now()
    OR credential_expires_at > now() + interval '180 days'
  THEN
    RAISE EXCEPTION 'invalid_registration_request' USING errcode = '22023';
  END IF;

  -- Serialize every registration for the same child. This prevents two clean
  -- installs racing and both ending up active.
  SELECT child.family_id
  INTO target_family_id
  FROM public.v2_children child
  WHERE child.id = target_child_id
    AND child.status = 'active'
  FOR UPDATE OF child;

  IF target_family_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.v2_guardian_memberships membership
      WHERE membership.family_id = target_family_id
        AND membership.guardian_user_id = actor_user_id
        AND membership.status = 'active'
    )
  THEN
    RAISE EXCEPTION 'guardian_not_authorized' USING errcode = '42501';
  END IF;

  SELECT *
  INTO existing_device
  FROM public.v2_protected_devices device
  WHERE device.installation_id = target_installation_id
  FOR UPDATE;

  IF existing_device.id IS NOT NULL
    AND existing_device.child_id <> target_child_id
  THEN
    RAISE EXCEPTION 'installation_already_assigned' USING errcode = '23505';
  END IF;

  -- Revoke credentials first; the whole function is transactional, so a
  -- later failure cannot leave the child without a working installation.
  UPDATE public.v2_device_credentials credential
  SET revoked_at = COALESCE(credential.revoked_at, now())
  WHERE credential.revoked_at IS NULL
    AND credential.device_id IN (
      SELECT device.id
      FROM public.v2_protected_devices device
      WHERE device.child_id = target_child_id
        AND (existing_device.id IS NULL OR device.id <> existing_device.id)
        AND device.status IN ('pending', 'active', 'degraded')
    );

  UPDATE public.v2_protected_devices device
  SET status = 'revoked',
      updated_at = now()
  WHERE device.child_id = target_child_id
    AND (existing_device.id IS NULL OR device.id <> existing_device.id)
    AND device.status IN ('pending', 'active', 'degraded');

  IF existing_device.id IS NULL THEN
    INSERT INTO public.v2_protected_devices (
      child_id,
      installation_id,
      app_version,
      capture_contract_version,
      manufacturer,
      model,
      status,
      last_seen_at
    )
    VALUES (
      target_child_id,
      target_installation_id,
      target_app_version,
      target_capture_contract_version,
      left(target_manufacturer, 120),
      left(target_model, 120),
      'active',
      now()
    )
    RETURNING id INTO resolved_device_id;
  ELSE
    UPDATE public.v2_protected_devices
    SET app_version = target_app_version,
        capture_contract_version = target_capture_contract_version,
        manufacturer = left(target_manufacturer, 120),
        model = left(target_model, 120),
        status = 'active',
        last_seen_at = now()
    WHERE id = existing_device.id
    RETURNING id INTO resolved_device_id;
  END IF;

  UPDATE public.v2_device_credentials credential
  SET revoked_at = COALESCE(credential.revoked_at, now())
  WHERE credential.device_id = resolved_device_id
    AND credential.revoked_at IS NULL;

  SELECT COALESCE(max(credential.key_version), 0) + 1
  INTO next_key_version
  FROM public.v2_device_credentials credential
  WHERE credential.device_id = resolved_device_id;

  INSERT INTO public.v2_device_credentials (
    device_id,
    credential_hash,
    key_version,
    expires_at
  )
  VALUES (
    resolved_device_id,
    new_credential_hash,
    next_key_version,
    credential_expires_at
  );

  INSERT INTO public.v2_audit_events (
    actor_user_id,
    actor_type,
    action,
    object_type,
    object_id,
    outcome
  )
  VALUES (
    actor_user_id,
    'guardian',
    'v2.device.register',
    'protected_device',
    resolved_device_id,
    'success'
  );

  RETURN QUERY
  SELECT resolved_device_id, next_key_version, credential_expires_at;
END;
$function$;

COMMENT ON FUNCTION public.v2_register_device_service(
  uuid,
  uuid,
  uuid,
  text,
  smallint,
  text,
  text,
  text,
  timestamp with time zone
) IS 'Registers the single canonical protected device for a child and revokes prior live installations.';
