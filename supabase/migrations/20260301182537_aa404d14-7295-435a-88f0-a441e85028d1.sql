
-- 1. Fix send_locate_to_all_devices: only send to devices seen in last 7 days
CREATE OR REPLACE FUNCTION public.send_locate_to_all_devices()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO device_commands (device_id, command_type, status)
    SELECT device_id, 'LOCATE_NOW', 'PENDING'
    FROM devices
    WHERE child_id IS NOT NULL
      AND last_seen > NOW() - INTERVAL '7 days';
    
    RAISE LOG 'Sent LOCATE_NOW to active devices (seen in last 7 days)';
END;
$function$;

-- 2. Fix check_unresponsive_devices: skip devices with recent last_seen, add ai_verdict + category
CREATE OR REPLACE FUNCTION public.check_unresponsive_devices()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_device RECORD;
    v_parent_id UUID;
    v_child_name TEXT;
    v_last_seen TIMESTAMPTZ;
BEGIN
    FOR v_device IN 
        SELECT DISTINCT dc.device_id, d.child_id, d.last_seen
        FROM device_commands dc
        JOIN devices d ON dc.device_id = d.device_id
        WHERE dc.status = 'PENDING'
        AND dc.command_type = 'LOCATE_NOW'
        AND dc.created_at < NOW() - INTERVAL '30 minutes'
        AND d.child_id IS NOT NULL
    LOOP
        -- Skip if device was seen in last 60 minutes (it's alive, just didn't respond to LOCATE)
        IF v_device.last_seen > NOW() - INTERVAL '60 minutes' THEN
            CONTINUE;
        END IF;

        SELECT c.parent_id, c.name INTO v_parent_id, v_child_name
        FROM children c
        WHERE c.id = v_device.child_id;

        INSERT INTO alerts (child_id, device_id, sender, content, ai_risk_score, is_processed, parent_message, ai_verdict, category)
        SELECT 
            v_device.child_id,
            v_device.device_id,
            'SYSTEM',
            'המכשיר לא מגיב לבדיקות',
            80,
            true,
            'המכשיר של ' || v_child_name || ' לא מגיב. ייתכן שהאפליקציה הוסרה או שאין חיבור לאינטרנט.',
            'notify',
            'system'
        WHERE NOT EXISTS (
            SELECT 1 FROM alerts 
            WHERE child_id = v_device.child_id 
            AND sender = 'SYSTEM'
            AND created_at > NOW() - INTERVAL '24 hours'
        );

        RAISE LOG 'Device % not responding - alert sent', v_device.device_id;
    END LOOP;
END;
$function$;

-- 3. Expire old PENDING LOCATE_NOW commands (older than 2 hours)
UPDATE device_commands
SET status = 'EXPIRED'
WHERE command_type = 'LOCATE_NOW'
  AND status = 'PENDING'
  AND created_at < NOW() - INTERVAL '2 hours';
