CREATE OR REPLACE FUNCTION public.generate_new_pairing_code(p_child_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_new_code TEXT;
BEGIN
    -- Generate random 6-digit code
    v_new_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    
    -- Update child with new code + expiration (24 hours)
    UPDATE children 
    SET pairing_code = v_new_code,
        pairing_code_expires_at = NOW() + INTERVAL '24 hours'
    WHERE id = p_child_id;
    
    -- Disconnect old device (don't delete - keep history!)
    -- Set child_id to NULL instead of deleting
    UPDATE devices 
    SET child_id = NULL 
    WHERE child_id = p_child_id;
    
    RETURN json_build_object(
        'success', true,
        'code', v_new_code,
        'expires_at', NOW() + INTERVAL '24 hours'
    );
END;
$function$;