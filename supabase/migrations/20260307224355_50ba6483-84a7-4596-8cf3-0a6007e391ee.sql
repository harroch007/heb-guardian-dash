
-- Update get_device_settings to read blocked apps from app_policies table
CREATE OR REPLACE FUNCTION public.get_device_settings(p_device_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_settings JSONB;
    v_child_id UUID;
    v_parent_id UUID;
    v_blocked_apps JSONB;
BEGIN
    -- Find child and parent for this device
    SELECT child_id INTO v_child_id FROM devices WHERE device_id = p_device_id;
    IF v_child_id IS NOT NULL THEN
        SELECT parent_id INTO v_parent_id FROM children WHERE id = v_child_id;
    END IF;
    
    -- Try device-specific settings
    SELECT row_to_json(s.*)::jsonb INTO v_settings
    FROM settings s
    WHERE s.device_id = p_device_id
    LIMIT 1;
    
    -- Fallback to child settings
    IF v_settings IS NULL AND v_child_id IS NOT NULL THEN
        SELECT row_to_json(s.*)::jsonb INTO v_settings
        FROM settings s
        WHERE s.child_id = v_child_id AND s.device_id IS NULL
        LIMIT 1;
    END IF;
    
    -- Fallback to parent settings
    IF v_settings IS NULL AND v_parent_id IS NOT NULL THEN
        SELECT row_to_json(s.*)::jsonb INTO v_settings
        FROM settings s
        WHERE s.parent_id = v_parent_id AND s.child_id IS NULL AND s.device_id IS NULL
        LIMIT 1;
    END IF;
    
    -- Default settings
    IF v_settings IS NULL THEN
        v_settings := jsonb_build_object(
            'monitoring_enabled', true,
            'notification_listener_enabled', true,
            'accessibility_service_enabled', true,
            'redaction_mode', 'STRICT',
            'local_llm_enabled', false,
            'remote_llm_enabled', true,
            'alert_on_trigger_words', true,
            'alert_on_unknown_contacts', true,
            'alert_threshold', 70,
            'screen_time_tracking_enabled', true,
            'daily_screen_time_limit_minutes', null,
            'location_tracking_enabled', true,
            'location_update_interval_minutes', 15,
            'blocked_apps', '[]'::jsonb,
            'custom_trigger_words', '[]'::jsonb,
            'version', 0
        );
    END IF;
    
    -- Override blocked_apps from app_policies table (child-wide)
    IF v_child_id IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(ap.package_name), '[]'::jsonb)
        INTO v_blocked_apps
        FROM app_policies ap
        WHERE ap.child_id = v_child_id AND ap.is_blocked = true;
        
        v_settings := v_settings || jsonb_build_object('blocked_apps', v_blocked_apps);
    END IF;
    
    RETURN v_settings;
END;
$function$;
