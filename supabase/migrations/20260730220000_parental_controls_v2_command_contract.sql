-- Kippy parental controls V2: authenticated, typed and idempotent command boundary.

ALTER TABLE public.device_commands
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS request_key text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS device_commands_device_request_key_uidx
  ON public.device_commands (device_id, request_key)
  WHERE request_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS device_commands_pending_device_type_idx
  ON public.device_commands (device_id, command_type, created_at DESC)
  WHERE status IN ('PENDING', 'ACKNOWLEDGED');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.device_commands'::regclass
      AND tgname = 'set_device_commands_updated_at'
  ) THEN
    CREATE TRIGGER set_device_commands_updated_at
      BEFORE UPDATE ON public.device_commands
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_parental_control_command_v2(
  p_device_id text,
  p_command_type text,
  p_request_key text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_ttl_seconds integer DEFAULT 120
)
RETURNS public.device_commands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.device_commands;
  v_command public.device_commands;
  v_command_type text := upper(btrim(p_command_type));
  v_request_key text := nullif(btrim(p_request_key), '');
  v_ttl_seconds integer := greatest(30, least(coalesce(p_ttl_seconds, 120), 900));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_command_type NOT IN (
    'REPORT_HEARTBEAT',
    'LOCATE_NOW',
    'RING_DEVICE',
    'REFRESH_SETTINGS'
  ) THEN
    RAISE EXCEPTION 'Unsupported parental-control command'
      USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_family_parent_for_device(p_device_id) THEN
    RAISE EXCEPTION 'Device is outside the caller family'
      USING ERRCODE = '42501';
  END IF;

  IF v_request_key IS NOT NULL THEN
    SELECT *
      INTO v_existing
      FROM public.device_commands
     WHERE device_id = p_device_id
       AND request_key = v_request_key
     LIMIT 1;

    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  INSERT INTO public.device_commands (
    device_id,
    command_type,
    status,
    payload,
    requested_by,
    request_key,
    expires_at
  )
  VALUES (
    p_device_id,
    v_command_type,
    'PENDING',
    coalesce(p_payload, '{}'::jsonb),
    auth.uid(),
    v_request_key,
    now() + make_interval(secs => v_ttl_seconds)
  )
  RETURNING * INTO v_command;

  RETURN v_command;
EXCEPTION
  WHEN unique_violation THEN
    IF v_request_key IS NOT NULL THEN
      SELECT *
        INTO v_existing
        FROM public.device_commands
       WHERE device_id = p_device_id
         AND request_key = v_request_key
       LIMIT 1;

      IF FOUND THEN
        RETURN v_existing;
      END IF;
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.request_parental_control_command_v2(
  text,
  text,
  text,
  jsonb,
  integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.request_parental_control_command_v2(
  text,
  text,
  text,
  jsonb,
  integer
) TO authenticated;

-- Parent commands must pass through the authenticated allowlisted RPC above.
DROP POLICY IF EXISTS "Parents can insert commands for their children devices"
  ON public.device_commands;

-- Remove the original unrestricted UPDATE policy. Device-scoped JWT and
-- temporary paired-device fallback policies were added by later migrations.
DROP POLICY IF EXISTS "Allow devices to update command status"
  ON public.device_commands;

COMMENT ON FUNCTION public.request_parental_control_command_v2(
  text,
  text,
  text,
  jsonb,
  integer
) IS
  'Creates an allowlisted parental-control device command for an authorized family parent. The optional request key makes retries idempotent.';
