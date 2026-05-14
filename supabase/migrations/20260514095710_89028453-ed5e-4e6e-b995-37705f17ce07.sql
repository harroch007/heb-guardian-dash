-- Add child_gender to pair_device RPC
DROP FUNCTION IF EXISTS public.pair_device(text, text);

CREATE OR REPLACE FUNCTION public.pair_device(p_device_id text, p_pairing_code text)
RETURNS TABLE(success boolean, child_id uuid, child_name text, child_gender text, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  v_child_id uuid;
  v_child_name text;
  v_child_gender text;
begin
  select id, name, gender
    into v_child_id, v_child_name, v_child_gender
  from children
  where pairing_code = p_pairing_code
    and (pairing_code_expires_at is null or pairing_code_expires_at > now());

  if v_child_id is null then
    return query select false, null::uuid, null::text, null::text, 'INVALID_OR_EXPIRED_CODE'::text;
    return;
  end if;

  insert into devices (device_id, child_id, created_at, last_seen)
  values (p_device_id, v_child_id, now(), now())
  on conflict (device_id)
  do update set
    child_id = excluded.child_id,
    last_seen = excluded.last_seen;

  return query select true, v_child_id, v_child_name, v_child_gender, null::text;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.pair_device(text, text) TO anon, authenticated;

-- Add child_gender to connect_child_device RPC
CREATE OR REPLACE FUNCTION public.connect_child_device(p_parent_email text, p_pairing_code text, p_device_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_parent_id UUID;
    v_child_id UUID;
    v_child_name TEXT;
    v_child_gender TEXT;
BEGIN
    SELECT id INTO v_parent_id 
    FROM parents 
    WHERE email = LOWER(p_parent_email);
    
    IF v_parent_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'EMAIL_NOT_FOUND');
    END IF;
    
    SELECT id, name, gender INTO v_child_id, v_child_name, v_child_gender
    FROM children 
    WHERE parent_id = v_parent_id 
    AND pairing_code = p_pairing_code
    AND (pairing_code_expires_at IS NULL OR pairing_code_expires_at > NOW());
    
    IF v_child_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'INVALID_CODE');
    END IF;
    
    INSERT INTO devices (device_id, child_id, created_at, last_seen)
    VALUES (p_device_id, v_child_id, NOW(), NOW())
    ON CONFLICT (device_id) 
    DO UPDATE SET 
        child_id = v_child_id,
        last_seen = NOW();
    
    RETURN json_build_object(
        'success', true, 
        'child_id', v_child_id,
        'child_name', v_child_name,
        'child_gender', v_child_gender,
        'parent_id', v_parent_id
    );
END;
$function$;

NOTIFY pgrst, 'reload schema';