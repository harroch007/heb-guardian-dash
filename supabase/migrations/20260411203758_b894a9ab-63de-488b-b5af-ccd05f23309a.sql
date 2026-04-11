
-- Fix on_time_request_insert: add NULL guard + hardcoded fallback URL
CREATE OR REPLACE FUNCTION on_time_request_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_name TEXT;
  v_recipient_id UUID;
  v_body TEXT;
  v_supabase_url TEXT := COALESCE(
    current_setting('app.settings.supabase_url', true),
    'https://fsedenvbdpctzoznppwo.supabase.co'
  );
  v_service_role_key TEXT := current_setting('app.settings.service_role_key', true);
BEGIN
  -- NULL guard: skip push if service role key is missing
  IF v_service_role_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only fire for pending requests
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_child_name FROM children WHERE id = NEW.child_id;

  IF v_child_name IS NOT NULL AND v_child_name <> '' THEN
    v_body := v_child_name || ' ביקש/ה עוד זמן למסך';
  ELSE
    v_body := 'יש בקשת זמן חדשה שמחכה לאישור';
  END IF;

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
        'title', 'בקשת זמן חדשה',
        'body', v_body,
        'url', '/child-v2/' || NEW.child_id,
        'child_name', COALESCE(v_child_name, '')
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Fix on_time_request_responded_push: add NULL guard + hardcoded fallback URL
CREATE OR REPLACE FUNCTION on_time_request_responded_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_name TEXT;
  v_recipient_id UUID;
  v_actor_id UUID := auth.uid();
  v_title TEXT;
  v_body TEXT;
  v_supabase_url TEXT := COALESCE(
    current_setting('app.settings.supabase_url', true),
    'https://fsedenvbdpctzoznppwo.supabase.co'
  );
  v_service_role_key TEXT := current_setting('app.settings.service_role_key', true);
BEGIN
  -- NULL guard: skip push if service role key is missing
  IF v_service_role_key IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status <> 'pending' THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  IF NEW.child_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_child_name FROM children WHERE id = NEW.child_id;

  IF NEW.status = 'approved' THEN
    v_title := 'בקשת הזמן אושרה';
    IF v_child_name IS NOT NULL AND v_child_name <> '' THEN
      v_body := v_child_name || ' קיבל/ה זמן נוסף';
    ELSE
      v_body := 'בקשת הזמן אושרה';
    END IF;
  ELSE
    v_title := 'בקשת הזמן נדחתה';
    IF v_child_name IS NOT NULL AND v_child_name <> '' THEN
      v_body := 'בקשת הזמן של ' || v_child_name || ' נדחתה';
    ELSE
      v_body := 'בקשת הזמן נדחתה';
    END IF;
  END IF;

  FOR v_recipient_id IN SELECT get_alert_recipients(NEW.child_id)
  LOOP
    IF v_actor_id IS NOT NULL AND v_recipient_id = v_actor_id THEN
      CONTINUE;
    END IF;

    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'parent_id', v_recipient_id,
        'title', v_title,
        'body', v_body,
        'url', '/child-v2/' || NEW.child_id,
        'child_name', COALESCE(v_child_name, '')
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;
