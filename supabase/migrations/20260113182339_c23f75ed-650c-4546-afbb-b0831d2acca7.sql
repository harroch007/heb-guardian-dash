CREATE OR REPLACE FUNCTION public.create_alert(
  p_message text, 
  p_risk_level integer, 
  p_source text, 
  p_device_id text, 
  p_chat_type text DEFAULT 'PRIVATE'::text, 
  p_message_count integer DEFAULT 0, 
  p_contact_hash text DEFAULT NULL::text, 
  p_pii_redacted_count integer DEFAULT 0, 
  p_sender_display text DEFAULT NULL::text, 
  p_author_type text DEFAULT 'UNKNOWN'::text, 
  p_chat_name text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_child_id UUID;
    v_alert_id BIGINT;
BEGIN
    -- ✅ Stamp first_seen_at only once (first real device activity)
    UPDATE public.devices
    SET first_seen_at = COALESCE(first_seen_at, now())
    WHERE device_id = p_device_id;

    SELECT child_id INTO v_child_id 
    FROM devices 
    WHERE device_id = p_device_id;
    
    INSERT INTO alerts (
        content,
        risk_score,
        sender,
        sender_display,
        device_id,
        chat_type,
        message_count,
        child_id,
        is_processed,
        should_alert,
        author_type,
        chat_name
    ) VALUES (
        p_message,
        p_risk_level,
        p_source,
        p_sender_display,
        p_device_id,
        p_chat_type,
        p_message_count,
        v_child_id,
        false,
        true,
        p_author_type,
        p_chat_name
    )
    RETURNING id INTO v_alert_id;
    
    RETURN v_alert_id;
END;
$$;