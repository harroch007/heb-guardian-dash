
-- Update delete_child_data to include new tables
CREATE OR REPLACE FUNCTION public.delete_child_data(p_child_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_alerts_deleted INT;
    v_app_usage_deleted INT;
    v_app_alerts_deleted INT;
    v_nightly_reports_deleted INT;
    v_devices_updated INT;
    v_settings_deleted INT;
    v_events_deleted INT;
    v_parent_id UUID;
BEGIN
    SELECT parent_id INTO v_parent_id
    FROM children
    WHERE id = p_child_id;
    
    IF v_parent_id IS NULL OR v_parent_id != auth.uid() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized or child not found'
        );
    END IF;
    
    DELETE FROM alerts WHERE child_id = p_child_id;
    GET DIAGNOSTICS v_alerts_deleted = ROW_COUNT;
    
    DELETE FROM app_usage WHERE child_id = p_child_id;
    GET DIAGNOSTICS v_app_usage_deleted = ROW_COUNT;
    
    DELETE FROM app_alerts WHERE child_id = p_child_id;
    GET DIAGNOSTICS v_app_alerts_deleted = ROW_COUNT;
    
    DELETE FROM nightly_usage_reports WHERE child_id = p_child_id;
    GET DIAGNOSTICS v_nightly_reports_deleted = ROW_COUNT;
    
    DELETE FROM settings WHERE child_id = p_child_id;
    GET DIAGNOSTICS v_settings_deleted = ROW_COUNT;
    
    DELETE FROM device_events WHERE child_id = p_child_id;
    GET DIAGNOSTICS v_events_deleted = ROW_COUNT;
    
    UPDATE devices SET child_id = NULL WHERE child_id = p_child_id;
    GET DIAGNOSTICS v_devices_updated = ROW_COUNT;
    
    DELETE FROM children WHERE id = p_child_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'deleted', jsonb_build_object(
            'alerts', v_alerts_deleted,
            'app_usage', v_app_usage_deleted,
            'app_alerts', v_app_alerts_deleted,
            'nightly_usage_reports', v_nightly_reports_deleted,
            'settings', v_settings_deleted,
            'device_events', v_events_deleted,
            'devices_disconnected', v_devices_updated,
            'child', 1
        )
    );
END;
$function$;

-- Update cleanup_old_data to include new tables
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_alerts_deleted INT;
    v_app_usage_deleted INT;
    v_app_alerts_deleted INT;
    v_nightly_reports_deleted INT;
    v_threshold TIMESTAMPTZ;
BEGIN
    v_threshold := NOW() - INTERVAL '30 days';
    
    DELETE FROM alerts WHERE created_at < v_threshold;
    GET DIAGNOSTICS v_alerts_deleted = ROW_COUNT;
    
    DELETE FROM app_usage WHERE created_at < v_threshold;
    GET DIAGNOSTICS v_app_usage_deleted = ROW_COUNT;
    
    DELETE FROM app_alerts WHERE created_at < v_threshold;
    GET DIAGNOSTICS v_app_alerts_deleted = ROW_COUNT;
    
    DELETE FROM nightly_usage_reports WHERE created_at < v_threshold;
    GET DIAGNOSTICS v_nightly_reports_deleted = ROW_COUNT;
    
    RETURN jsonb_build_object(
        'success', true,
        'deleted', jsonb_build_object(
            'alerts', v_alerts_deleted,
            'app_usage', v_app_usage_deleted,
            'app_alerts', v_app_alerts_deleted,
            'nightly_usage_reports', v_nightly_reports_deleted
        )
    );
END;
$function$;
