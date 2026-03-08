
-- ============================================
-- Phase A: Kippy Control Must-Have Data Model
-- ============================================

-- 1. installed_apps — Full device app inventory
CREATE TABLE public.installed_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  package_name text NOT NULL,
  app_name text,
  category text,
  is_system boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, package_name)
);

ALTER TABLE public.installed_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view their children installed apps"
  ON public.installed_apps FOR SELECT
  TO authenticated
  USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

CREATE POLICY "Admins can view all installed apps"
  ON public.installed_apps FOR SELECT
  TO authenticated
  USING (is_admin());

-- Device inserts via RPC (SECURITY DEFINER), no direct INSERT policy needed

-- 2. schedule_windows — School, bedtime, shabbat schedules
CREATE TABLE public.schedule_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  name text NOT NULL,
  schedule_type text NOT NULL CHECK (schedule_type IN ('daily_recurring', 'weekly_recurring', 'shabbat')),
  days_of_week int[],
  start_time time,
  end_time time,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view their children schedule windows"
  ON public.schedule_windows FOR SELECT
  TO authenticated
  USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

CREATE POLICY "Parents can insert schedule windows for their children"
  ON public.schedule_windows FOR INSERT
  TO authenticated
  WITH CHECK (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

CREATE POLICY "Parents can update their children schedule windows"
  ON public.schedule_windows FOR UPDATE
  TO authenticated
  USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

CREATE POLICY "Parents can delete their children schedule windows"
  ON public.schedule_windows FOR DELETE
  TO authenticated
  USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

CREATE POLICY "Admins can manage all schedule windows"
  ON public.schedule_windows FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Auto-update updated_at
CREATE TRIGGER set_schedule_windows_updated_at
  BEFORE UPDATE ON public.schedule_windows
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. shabbat_zmanim — Date-based candle lighting / havdalah lookup
CREATE TABLE public.shabbat_zmanim (
  friday_date date PRIMARY KEY,
  candle_lighting time NOT NULL,
  havdalah time NOT NULL
);

ALTER TABLE public.shabbat_zmanim ENABLE ROW LEVEL SECURITY;

-- Everyone can read (device RPC + parent UI)
CREATE POLICY "Authenticated can read shabbat zmanim"
  ON public.shabbat_zmanim FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage shabbat zmanim"
  ON public.shabbat_zmanim FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 4. RPC: report_installed_apps — Device reports full app inventory
CREATE OR REPLACE FUNCTION public.report_installed_apps(
  p_device_id text,
  p_apps jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_child_id uuid;
  v_app jsonb;
BEGIN
  SELECT child_id INTO v_child_id FROM devices WHERE device_id = p_device_id;
  IF v_child_id IS NULL THEN
    RETURN;
  END IF;

  FOR v_app IN SELECT * FROM jsonb_array_elements(p_apps)
  LOOP
    INSERT INTO installed_apps (child_id, package_name, app_name, is_system, last_seen_at)
    VALUES (
      v_child_id,
      v_app->>'package_name',
      v_app->>'app_name',
      COALESCE((v_app->>'is_system')::boolean, false),
      now()
    )
    ON CONFLICT (child_id, package_name)
    DO UPDATE SET
      app_name = COALESCE(EXCLUDED.app_name, installed_apps.app_name),
      is_system = EXCLUDED.is_system,
      last_seen_at = now();
  END LOOP;
END;
$$;

-- 5. Extend get_device_settings to include schedule_windows
CREATE OR REPLACE FUNCTION public.get_device_settings(p_device_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_settings JSONB;
    v_child_id UUID;
    v_parent_id UUID;
    v_blocked_apps JSONB;
    v_schedules JSONB;
    v_shabbat_row RECORD;
BEGIN
    -- Find child and parent for this device
    SELECT child_id INTO v_child_id FROM devices WHERE device_id = p_device_id;
    IF v_child_id IS NOT NULL THEN
        SELECT parent_id INTO v_parent_id FROM children WHERE id = v_child_id;
    END IF;
    
    -- Try device-specific settings
    SELECT row_to_json(s.*)::jsonb INTO v_settings
    FROM settings s
    WHERE s.device_id = p_device_id
    LIMIT 1;
    
    -- Fallback to child settings
    IF v_settings IS NULL AND v_child_id IS NOT NULL THEN
        SELECT row_to_json(s.*)::jsonb INTO v_settings
        FROM settings s
        WHERE s.child_id = v_child_id AND s.device_id IS NULL
        LIMIT 1;
    END IF;
    
    -- Fallback to parent settings
    IF v_settings IS NULL AND v_parent_id IS NOT NULL THEN
        SELECT row_to_json(s.*)::jsonb INTO v_settings
        FROM settings s
        WHERE s.parent_id = v_parent_id AND s.child_id IS NULL AND s.device_id IS NULL
        LIMIT 1;
    END IF;
    
    -- Default settings
    IF v_settings IS NULL THEN
        v_settings := jsonb_build_object(
            'monitoring_enabled', true,
            'notification_listener_enabled', true,
            'accessibility_service_enabled', true,
            'redaction_mode', 'STRICT',
            'local_llm_enabled', false,
            'remote_llm_enabled', true,
            'alert_on_trigger_words', true,
            'alert_on_unknown_contacts', true,
            'alert_threshold', 70,
            'screen_time_tracking_enabled', true,
            'daily_screen_time_limit_minutes', null,
            'location_tracking_enabled', true,
            'location_update_interval_minutes', 15,
            'blocked_apps', '[]'::jsonb,
            'custom_trigger_words', '[]'::jsonb,
            'version', 0
        );
    END IF;
    
    -- Override blocked_apps from app_policies table (child-wide)
    IF v_child_id IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(ap.package_name), '[]'::jsonb)
        INTO v_blocked_apps
        FROM app_policies ap
        WHERE ap.child_id = v_child_id AND ap.is_blocked = true;
        
        v_settings := v_settings || jsonb_build_object('blocked_apps', v_blocked_apps);
    END IF;

    -- Add active schedule_windows for the child
    IF v_child_id IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', sw.id,
            'name', sw.name,
            'schedule_type', sw.schedule_type,
            'days_of_week', sw.days_of_week,
            'start_time', sw.start_time,
            'end_time', sw.end_time
          )
        ), '[]'::jsonb)
        INTO v_schedules
        FROM schedule_windows sw
        WHERE sw.child_id = v_child_id AND sw.is_active = true;

        -- For shabbat schedules, resolve concrete times from shabbat_zmanim
        -- Find the next upcoming Friday
        SELECT sz.* INTO v_shabbat_row
        FROM shabbat_zmanim sz
        WHERE sz.friday_date >= CURRENT_DATE
        ORDER BY sz.friday_date
        LIMIT 1;

        IF v_shabbat_row IS NOT NULL THEN
          v_settings := v_settings || jsonb_build_object(
            'next_shabbat', jsonb_build_object(
              'friday_date', v_shabbat_row.friday_date,
              'candle_lighting', v_shabbat_row.candle_lighting,
              'havdalah', v_shabbat_row.havdalah
            )
          );
        END IF;

        v_settings := v_settings || jsonb_build_object('schedule_windows', v_schedules);
    END IF;
    
    RETURN v_settings;
END;
$$;
