
-- Step 1: Drop the wrong trigger and function on device_events
DROP TRIGGER IF EXISTS trg_geofence_event_push ON device_events;
DROP FUNCTION IF EXISTS on_geofence_event_insert();

-- Step 2: Create the correct trigger function on alerts
CREATE OR REPLACE FUNCTION public.on_geofence_alert_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_name TEXT;
  v_title TEXT;
  v_body TEXT;
  v_recipient_id UUID;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Only handle geofence alerts
  IF NEW.category IS DISTINCT FROM 'geofence' THEN
    RETURN NEW;
  END IF;

  -- Need child_id to resolve recipients
  IF NEW.child_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get child name
  SELECT name INTO v_child_name FROM children WHERE id = NEW.child_id;

  -- Build push content
  v_title := 'התראת מיקום';

  -- Use parent_message if available (Android writes human-readable text here)
  IF NEW.parent_message IS NOT NULL AND NEW.parent_message <> '' THEN
    v_body := NEW.parent_message;
  ELSIF v_child_name IS NOT NULL THEN
    v_body := v_child_name || ' - זוהתה חריגה מאזור מוגדר';
  ELSE
    v_body := 'זוהתה חריגה מאזור מוגדר';
  END IF;

  -- Get Supabase config
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);

  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1);
  END IF;
  IF v_service_key IS NULL OR v_service_key = '' THEN
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
        'alert_id', NEW.id,
        'child_name', COALESCE(v_child_name, '')
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Step 3: Create AFTER INSERT trigger on alerts for geofence push
CREATE TRIGGER trg_geofence_alert_push
  AFTER INSERT ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION on_geofence_alert_insert();
