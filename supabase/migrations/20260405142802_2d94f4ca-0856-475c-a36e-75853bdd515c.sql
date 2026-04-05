
-- Trigger function: send parent push on geofence alert creation
CREATE OR REPLACE FUNCTION public.on_geofence_event_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_name TEXT;
  v_place_label TEXT;
  v_event_direction TEXT;
  v_title TEXT;
  v_body TEXT;
  v_recipient_id UUID;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Only handle geofence events
  IF NEW.event_type NOT LIKE 'GEOFENCE_%' THEN
    RETURN NEW;
  END IF;

  -- Need child_id to resolve recipients
  IF NEW.child_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Avoid re-notifying
  IF NEW.is_notified = true THEN
    RETURN NEW;
  END IF;

  -- Get child name
  SELECT name INTO v_child_name FROM children WHERE id = NEW.child_id;

  -- Extract place label and direction from event_data
  v_place_label := NEW.event_data->>'place_label';
  v_event_direction := CASE
    WHEN NEW.event_type = 'GEOFENCE_EXIT' THEN 'יצא/ה מ'
    WHEN NEW.event_type = 'GEOFENCE_ENTER' THEN 'נכנס/ה ל'
    ELSE ''
  END;

  -- Build push content
  v_title := 'התראת מיקום';
  IF v_place_label IS NOT NULL AND v_child_name IS NOT NULL THEN
    v_body := v_child_name || ' ' || v_event_direction || v_place_label;
  ELSIF v_child_name IS NOT NULL THEN
    v_body := v_child_name || ' - זוהתה חריגה מאזור מוגדר';
  ELSE
    v_body := 'זוהתה חריגה מאזור מוגדר';
  END IF;

  -- Get Supabase config
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);

  IF v_supabase_url IS NULL THEN
    v_supabase_url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1);
  END IF;
  IF v_service_key IS NULL THEN
    v_service_key := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1);
  END IF;

  -- Send push to each recipient via get_alert_recipients
  FOR v_recipient_id IN SELECT get_alert_recipients(NEW.child_id)
  LOOP
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'parent_id', v_recipient_id,
        'title', v_title,
        'body', v_body,
        'url', '/alerts',
        'child_name', COALESCE(v_child_name, '')
      )
    );
  END LOOP;

  -- Mark as notified
  NEW.is_notified := true;

  RETURN NEW;
END;
$$;

-- Create trigger: BEFORE INSERT so we can set is_notified on the row
CREATE TRIGGER trg_geofence_event_push
  BEFORE INSERT ON device_events
  FOR EACH ROW
  EXECUTE FUNCTION on_geofence_event_insert();
