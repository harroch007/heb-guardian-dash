CREATE OR REPLACE FUNCTION public.check_unresponsive_devices()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_device RECORD;
    v_parent_id UUID;
    v_child_name TEXT;
BEGIN
    -- מצא מכשירים עם פקודות PENDING שנשלחו לפני יותר מ-30 דקות
    FOR v_device IN 
        SELECT DISTINCT dc.device_id, d.child_id
        FROM device_commands dc
        JOIN devices d ON dc.device_id = d.device_id
        WHERE dc.status = 'PENDING'
        AND dc.command_type = 'LOCATE_NOW'
        AND dc.created_at < NOW() - INTERVAL '30 minutes'
        AND d.child_id IS NOT NULL
    LOOP
        -- קבל פרטי הורה וילד
        SELECT c.parent_id, c.name INTO v_parent_id, v_child_name
        FROM children c
        WHERE c.id = v_device.child_id;

        -- צור התראה להורה (רק אם אין כבר התראה דומה היום)
        INSERT INTO alerts (child_id, device_id, sender, content, ai_risk_score, is_processed, parent_message)
        SELECT 
            v_device.child_id,
            v_device.device_id,
            'SYSTEM',
            'המכשיר לא מגיב לבדיקות',
            80,
            true,
            'המכשיר של ' || v_child_name || ' לא מגיב. ייתכן שהאפליקציה הוסרה או שאין חיבור לאינטרנט.'
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