-- Fix on_app_alert_insert: invoke send-push-notification using the public anon key
-- (the function has verify_jwt = false; auth header is not validated). This removes
-- the dependency on the missing app.settings.service_role_key GUC.
CREATE OR REPLACE FUNCTION public.on_app_alert_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_child_name TEXT;
  v_app_name TEXT;
  v_recipient_id UUID;
  v_body TEXT;
  v_supabase_url TEXT := 'https://fsedenvbdpctzoznppwo.supabase.co';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZWRlbnZiZHBjdHpvem5wcHdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNjkxMzcsImV4cCI6MjA4MTg0NTEzN30.Lvu-qGDtzhL3-7QHdzimsRWQ2I6Wy7jJasidbfEFrVU';
BEGIN
  IF NEW.child_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_child_name FROM children WHERE id = NEW.child_id;
  v_app_name := NEW.app_name;

  IF v_child_name IS NOT NULL AND v_child_name <> '' AND v_app_name IS NOT NULL AND v_app_name <> '' THEN
    v_body := v_child_name || ' התקין/ה את ' || v_app_name;
  ELSIF v_app_name IS NOT NULL AND v_app_name <> '' THEN
    v_body := 'אפליקציה חדשה זוהתה: ' || v_app_name;
  ELSE
    v_body := 'זוהתה אפליקציה חדשה במכשיר';
  END IF;

  BEGIN
    FOR v_recipient_id IN SELECT get_alert_recipients(NEW.child_id)
    LOOP
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-push-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_anon_key,
            'apikey', v_anon_key
          ),
          body := jsonb_build_object(
            'parent_id', v_recipient_id,
            'title', 'אפליקציה חדשה זוהתה',
            'body', v_body,
            'url', '/home-v2',
            'child_name', COALESCE(v_child_name, '')
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'on_app_alert_insert: net.http_post failed for recipient %: %', v_recipient_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'on_app_alert_insert: push dispatch block failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

NOTIFY pgrst, 'reload schema';