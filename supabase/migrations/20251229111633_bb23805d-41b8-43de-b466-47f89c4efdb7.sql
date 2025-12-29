-- Add pairing_code_expires_at column to children table
ALTER TABLE children 
ADD COLUMN IF NOT EXISTS pairing_code_expires_at TIMESTAMPTZ DEFAULT NULL;

-- Create function to generate new pairing code and disconnect device
CREATE OR REPLACE FUNCTION generate_new_pairing_code(p_child_id UUID)
RETURNS JSON AS $$
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
    
    -- Delete old device from devices table
    DELETE FROM devices WHERE child_id = p_child_id;
    
    RETURN json_build_object(
        'success', true,
        'code', v_new_code,
        'expires_at', NOW() + INTERVAL '24 hours'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;