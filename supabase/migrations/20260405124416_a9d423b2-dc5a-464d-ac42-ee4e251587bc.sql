
CREATE OR REPLACE FUNCTION public.on_app_alert_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_name TEXT;
  v_app_name TEXT;
  v_recipient_id UUID;
  v_body TEXT;
  v_supabase_url TEXT := current_setting('app.settings.supabase_url', true);
  v_service_role_key TEXT := current_setting('app.settings.service_role_key', true);
BEGIN
  -- Skip if no child paired
  IF NEW.child_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve child name
  SELECT name INTO v_child_name FROM children WHERE id = NEW.child_id;

  -- Resolve app name
  v_app_name := NEW.app_name;

  -- Build body text
  IF v_child_name IS NOT NULL AND v_child_name <> '' AND v_app_name IS NOT NULL AND v_app_name <> '' THEN
    v_body := v_child_name || ' התקין/ה את ' || v_app_name;
  ELSIF v_app_name IS NOT NULL AND v_app_name <> '' THEN
    v_body := 'אפליקציה חדשה זוהתה: ' || v_app_name;
  ELSE
    v_body := 'זוהתה אפליקציה חדשה במכשיר';
  END IF;

  -- Send push to each recipient
  FOR v_recipient_id IN SELECT get_alert_recipients(NEW.child_id)
  LOOP
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'parent_id', v_recipient_id,
        'title', 'אפליקציה חדשה זוהתה',
        'body', v_body,
        'url', '/child-v2/' || NEW.child_id,
        'child_name', COALESCE(v_child_name, '')
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_app_alert_push
  AFTER INSERT ON public.app_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.on_app_alert_insert();
