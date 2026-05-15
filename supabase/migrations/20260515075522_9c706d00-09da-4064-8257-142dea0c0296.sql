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
  IF NEW.category IS DISTINCT FROM 'geofence' THEN
    RETURN NEW;
  END IF;

  IF NEW.child_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT name INTO v_child_name FROM children WHERE id = NEW.child_id;

    v_title := 'התראת מיקום';
    IF NEW.parent_message IS NOT NULL AND NEW.parent_message <> '' THEN
      v_body := NEW.parent_message;
    ELSIF v_child_name IS NOT NULL THEN
      v_body := v_child_name || ' - זוהתה חריגה מאזור מוגדר';
    ELSE
      v_body := 'זוהתה חריגה מאזור מוגדר';
    END IF;

    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_service_key := current_setting('app.settings.service_role_key', true);

    IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
      BEGIN
        v_supabase_url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1);
      EXCEPTION WHEN OTHERS THEN
        v_supabase_url := NULL;
      END;
    END IF;
    IF v_service_key IS NULL OR v_service_key = '' THEN
      BEGIN
        v_service_key := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1);
      EXCEPTION WHEN OTHERS THEN
        v_service_key := NULL;
      END;
    END IF;

    IF v_supabase_url IS NULL OR v_supabase_url = '' OR v_service_key IS NULL OR v_service_key = '' THEN
      RAISE WARNING 'on_geofence_alert_insert: missing supabase_url/service_role_key, skipping push for alert %', NEW.id;
      RETURN NEW;
    END IF;

    FOR v_recipient_id IN SELECT get_alert_recipients(NEW.child_id)
    LOOP
      BEGIN
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
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'on_geofence_alert_insert push failed for alert % recipient %: %', NEW.id, v_recipient_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'on_geofence_alert_insert outer failure for alert %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;