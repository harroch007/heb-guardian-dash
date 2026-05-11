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
  v_service_role_key TEXT;
BEGIN
  IF NEW.child_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Try to read service role key from GUC; if missing, skip push gracefully
  BEGIN
    v_service_role_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    v_service_role_key := NULL;
  END;

  SELECT name INTO v_child_name FROM children WHERE id = NEW.child_id;
  v_app_name := NEW.app_name;

  IF v_child_name IS NOT NULL AND v_child_name <> '' AND v_app_name IS NOT NULL AND v_app_name <> '' THEN
    v_body := v_child_name || ' התקין/ה את ' || v_app_name;
  ELSIF v_app_name IS NOT NULL AND v_app_name <> '' THEN
    v_body := 'אפליקציה חדשה זוהתה: ' || v_app_name;
  ELSE
    v_body := 'זוהתה אפליקציה חדשה במכשיר';
  END IF;

  -- Wrap entire push dispatch so failures (null url, pg_net errors, missing key) do NOT roll back the alert insert
  BEGIN
    IF v_service_role_key IS NULL OR length(v_service_role_key) = 0 THEN
      RAISE WARNING 'on_app_alert_insert: service_role_key GUC not set; skipping push dispatch for alert %', NEW.id;
    ELSE
      FOR v_recipient_id IN SELECT get_alert_recipients(NEW.child_id)
      LOOP
        BEGIN
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
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'on_app_alert_insert: net.http_post failed for recipient %: %', v_recipient_id, SQLERRM;
        END;
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'on_app_alert_insert: push dispatch block failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.report_pending_app(
  p_device_id text,
  p_package_name text,
  p_app_name text DEFAULT NULL::text,
  p_was_blocked_attempt boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_jwt_role text;
  v_jwt_device_id text;
  v_child_id uuid;
  v_existed boolean := false;
  v_recent_alert boolean := false;
  v_push_sent boolean := false;
BEGIN
  IF p_device_id IS NULL OR length(trim(p_device_id)) = 0 THEN
    RAISE EXCEPTION 'p_device_id is required';
  END IF;
  IF p_package_name IS NULL OR length(trim(p_package_name)) = 0 THEN
    RAISE EXCEPTION 'p_package_name is required';
  END IF;

  v_jwt_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  v_jwt_device_id := public.get_device_id_from_jwt();

  IF v_jwt_role = 'device' AND v_jwt_device_id = p_device_id THEN
    NULL;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.devices
      WHERE device_id = p_device_id AND child_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED';
    END IF;
  END IF;

  SELECT child_id INTO v_child_id
  FROM public.devices
  WHERE device_id = p_device_id;

  IF v_child_id IS NULL THEN
    RAISE EXCEPTION 'Device not linked to a child';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.installed_apps
    WHERE child_id = v_child_id AND package_name = p_package_name
  ) INTO v_existed;

  INSERT INTO public.installed_apps (child_id, package_name, app_name, is_system, last_seen_at)
  VALUES (v_child_id, p_package_name, p_app_name, false, now())
  ON CONFLICT (child_id, package_name)
  DO UPDATE SET
    app_name     = COALESCE(EXCLUDED.app_name, public.installed_apps.app_name),
    last_seen_at = now();

  IF p_was_blocked_attempt THEN
    INSERT INTO public.blocked_app_attempts (device_id, child_id, package_name, app_name)
    VALUES (p_device_id, v_child_id, p_package_name, p_app_name);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.app_alerts
    WHERE child_id = v_child_id
      AND package_name = p_package_name
      AND created_at > now() - interval '24 hours'
  ) INTO v_recent_alert;

  IF NOT v_recent_alert THEN
    -- Resilience: never let push failures roll back the upsert/blocked log
    BEGIN
      PERFORM public.create_app_alert(p_device_id, p_package_name, p_app_name);
      v_push_sent := true;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'report_pending_app: create_app_alert failed: %', SQLERRM;
      v_push_sent := false;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'child_id', v_child_id,
    'is_new', NOT v_existed,
    'pending', NOT EXISTS (
      SELECT 1 FROM public.app_policies
      WHERE child_id = v_child_id AND package_name = p_package_name
    ),
    'push_sent', v_push_sent
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';