
-- Fix on_chore_completed_push: add NULL guard with hardcoded fallback URL
CREATE OR REPLACE FUNCTION on_chore_completed_push()
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

  -- Only fire on transition to 'completed_by_child'
  IF NEW.status <> 'completed_by_child' OR OLD.status = 'completed_by_child' THEN
    RETURN NEW;
  END IF;

  IF NEW.child_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_child_name FROM children WHERE id = NEW.child_id;

  IF v_child_name IS NOT NULL AND v_child_name <> '' THEN
    v_body := v_child_name || ' השלים/ה את ' || NEW.title;
  ELSE
    v_body := 'משימה הושלמה';
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
        'title', 'משימה הושלמה',
        'body', v_body,
        'url', '/child-v2/' || NEW.child_id,
        'child_name', COALESCE(v_child_name, '')
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Fix on_chore_created_push: add NULL guard with hardcoded fallback URL
CREATE OR REPLACE FUNCTION on_chore_created_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_name TEXT;
  v_recipient_id UUID;
  v_actor_id UUID := auth.uid();
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

  IF NEW.child_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_child_name FROM children WHERE id = NEW.child_id;

  IF v_child_name IS NOT NULL AND v_child_name <> '' THEN
    v_body := v_child_name || ' קיבל/ה משימה חדשה: ' || NEW.title;
  ELSE
    v_body := 'נוספה משימה חדשה';
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
        'title', 'משימה חדשה נוספה',
        'body', v_body,
        'url', '/child-v2/' || NEW.child_id,
        'child_name', COALESCE(v_child_name, '')
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;
