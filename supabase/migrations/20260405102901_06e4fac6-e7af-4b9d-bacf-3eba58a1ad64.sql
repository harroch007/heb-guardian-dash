
-- 1. Shared recipient resolution helper
CREATE OR REPLACE FUNCTION public.get_alert_recipients(p_child_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Owner always receives
  SELECT parent_id FROM children WHERE id = p_child_id
  UNION
  -- Accepted co-parents with receive_alerts = true
  SELECT fm.member_id
  FROM family_members fm
  JOIN children c ON c.id = p_child_id AND fm.owner_id = c.parent_id
  WHERE fm.status = 'accepted'
    AND fm.receive_alerts = true
    AND fm.member_id IS NOT NULL;
$$;

-- 2. Updated on_heartbeat_insert with co-parent-aware push delivery
CREATE OR REPLACE FUNCTION public.on_heartbeat_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prev_permissions jsonb;
  v_child_id uuid;
  v_child_name text;
  v_parent_id uuid;
  v_recipient_id uuid;
  v_perm_key text;
  v_perm_label text;
  v_alert_id bigint;
  v_perm_labels jsonb := '{
    "accessibilityEnabled": "Accessibility Service",
    "notificationListenerEnabled": "Notification Listener",
    "usageStatsGranted": "Usage Stats",
    "locationPermissionGranted": "Location Permission",
    "locationServicesEnabled": "Location Services",
    "batteryOptimizationIgnored": "Battery Optimization"
  }'::jsonb;
BEGIN
  -- Always update device metadata from heartbeat
  UPDATE public.devices
  SET
    device_model = COALESCE(NEW.device->>'model', device_model),
    device_manufacturer = COALESCE(NEW.device->>'manufacturer', device_manufacturer),
    battery_level = COALESCE((NEW.device->>'batteryLevel')::int, battery_level),
    last_seen = now()
  WHERE device_id = NEW.device_id;

  -- Get previous heartbeat for this device
  SELECT permissions INTO v_prev_permissions
  FROM public.device_heartbeats_raw
  WHERE device_id = NEW.device_id
    AND id < NEW.id
  ORDER BY reported_at DESC
  LIMIT 1;

  IF v_prev_permissions IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT d.child_id, c.name, c.parent_id
  INTO v_child_id, v_child_name, v_parent_id
  FROM public.devices d
  JOIN public.children c ON c.id = d.child_id
  WHERE d.device_id = NEW.device_id;

  IF v_child_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    FOR v_perm_key IN SELECT jsonb_object_keys(v_perm_labels)
    LOOP
      IF (v_prev_permissions->>v_perm_key)::boolean IS TRUE
         AND (NEW.permissions->>v_perm_key)::boolean IS NOT TRUE
      THEN
        v_perm_label := v_perm_labels->>v_perm_key;

        IF NOT EXISTS (
          SELECT 1 FROM public.alerts
          WHERE child_id = v_child_id
            AND category = 'system'
            AND sender = 'SYSTEM'
            AND created_at > now() - interval '24 hours'
            AND content LIKE '%' || v_perm_label || '%'
        ) THEN
          INSERT INTO public.alerts (
            child_id, device_id, sender, content, parent_message,
            ai_risk_score, ai_verdict, is_processed, category, platform
          ) VALUES (
            v_child_id,
            NEW.device_id,
            'SYSTEM',
            '⚠️ ההרשאה ' || v_perm_label || ' הוסרה מהמכשיר של ' || v_child_name,
            'ההרשאה "' || v_perm_label || '" הוסרה מהמכשיר של ' || v_child_name || '. ייתכן שהילד/ה ביטל/ה אותה ידנית. יש לפתוח את אפליקציית Kippy במכשיר ולהפעיל מחדש.',
            85,
            'notify',
            true,
            'system',
            'SYSTEM'
          ) RETURNING id INTO v_alert_id;

          -- Send push to all alert recipients (owner + co-parents)
          FOR v_recipient_id IN SELECT get_alert_recipients(v_child_id)
          LOOP
            BEGIN
              PERFORM net.http_post(
                url := 'https://fsedenvbdpctzoznppwo.supabase.co/functions/v1/send-push-notification',
                body := jsonb_build_object(
                  'parent_id', v_recipient_id,
                  'title', '⚠️ הרשאה הוסרה',
                  'body', 'ההרשאה "' || v_perm_label || '" הוסרה מהמכשיר של ' || v_child_name,
                  'url', '/alerts',
                  'alert_id', v_alert_id,
                  'child_name', v_child_name
                ),
                headers := jsonb_build_object(
                  'Content-Type', 'application/json',
                  'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZWRlbnZiZHBjdHpvem5wcHdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNjkxMzcsImV4cCI6MjA4MTg0NTEzN30.Lvu-qGDtzhL3-7QHdzimsRWQ2I6Wy7jJasidbfEFrVU'
                )
              );
            EXCEPTION WHEN OTHERS THEN
              RAISE WARNING 'on_heartbeat_insert: push notification failed for recipient=% alert_id=% err=%', v_recipient_id, v_alert_id, SQLERRM;
            END;
          END LOOP;
        END IF;
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'on_heartbeat_insert: permission alert creation failed err=%', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;
