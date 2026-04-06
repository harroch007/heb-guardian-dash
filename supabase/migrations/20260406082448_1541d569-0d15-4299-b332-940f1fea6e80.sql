
-- 1. Trigger function for chore INSERT (parent created chore)
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
  v_supabase_url TEXT := current_setting('app.settings.supabase_url', true);
  v_service_role_key TEXT := current_setting('app.settings.service_role_key', true);
BEGIN
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
    -- Skip self-push for parent-originated event
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

-- 2. Trigger function for chore UPDATE to 'completed_by_child' (child action)
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
  v_supabase_url TEXT := current_setting('app.settings.supabase_url', true);
  v_service_role_key TEXT := current_setting('app.settings.service_role_key', true);
BEGIN
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

  -- Child action: notify ALL recipients (no actor exclusion)
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

-- 3. Update existing notify_child_chore_deleted to also send parent push
CREATE OR REPLACE FUNCTION notify_child_chore_deleted()
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
  v_supabase_url TEXT := current_setting('app.settings.supabase_url', true);
  v_service_role_key TEXT := current_setting('app.settings.service_role_key', true);
BEGIN
  -- Existing behavior: send REFRESH_CHORES to device
  INSERT INTO device_commands (device_id, command_type, status)
  SELECT d.device_id, 'REFRESH_CHORES', 'PENDING'
  FROM devices d
  WHERE d.child_id = OLD.child_id;

  -- New: parent push with actor exclusion
  IF OLD.child_id IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT name INTO v_child_name FROM children WHERE id = OLD.child_id;

  IF v_child_name IS NOT NULL AND v_child_name <> '' THEN
    v_body := 'הוסרה משימה של ' || v_child_name;
  ELSE
    v_body := 'משימה הוסרה';
  END IF;

  FOR v_recipient_id IN SELECT get_alert_recipients(OLD.child_id)
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
        'title', 'משימה הוסרה',
        'body', v_body,
        'url', '/child-v2/' || OLD.child_id,
        'child_name', COALESCE(v_child_name, '')
      )
    );
  END LOOP;

  RETURN OLD;
END;
$$;

-- 4. Trigger function for time request response (approved/rejected)
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
  v_supabase_url TEXT := current_setting('app.settings.supabase_url', true);
  v_service_role_key TEXT := current_setting('app.settings.service_role_key', true);
BEGIN
  -- Only fire on transition from 'pending' to 'approved' or 'rejected'
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
    -- Skip self-push for parent-originated event
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

-- Create triggers

-- Chore created trigger
CREATE TRIGGER trg_chore_created_push
  AFTER INSERT ON chores
  FOR EACH ROW
  EXECUTE FUNCTION on_chore_created_push();

-- Chore completed trigger
CREATE TRIGGER trg_chore_completed_push
  AFTER UPDATE ON chores
  FOR EACH ROW
  EXECUTE FUNCTION on_chore_completed_push();

-- Time request responded trigger
CREATE TRIGGER trg_time_request_responded_push
  AFTER UPDATE ON time_extension_requests
  FOR EACH ROW
  EXECUTE FUNCTION on_time_request_responded_push();
