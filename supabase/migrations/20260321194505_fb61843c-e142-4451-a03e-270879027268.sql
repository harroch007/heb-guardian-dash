
-- 1. Create issur_melacha_windows table
CREATE TABLE public.issur_melacha_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  lock_type text NOT NULL CHECK (lock_type IN ('shabbat', 'yom_tov')),
  event_name text NOT NULL,
  event_key text NOT NULL,
  valid_for_date date NOT NULL,
  start_epoch_ms bigint NOT NULL,
  end_epoch_ms bigint NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Jerusalem',
  source text NOT NULL DEFAULT 'hebcal_jewish_calendar',
  computed_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (child_id, event_key, start_epoch_ms)
);

ALTER TABLE public.issur_melacha_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.issur_melacha_windows
  FOR ALL TO service_role USING (true);

CREATE INDEX idx_issur_melacha_child_start ON public.issur_melacha_windows (child_id, start_epoch_ms);
CREATE INDEX idx_issur_melacha_child_end ON public.issur_melacha_windows (child_id, end_epoch_ms);
CREATE INDEX idx_issur_melacha_active ON public.issur_melacha_windows (child_id, is_active, start_epoch_ms, end_epoch_ms);

-- 2. Update get_device_settings to include issur_melacha_windows
CREATE OR REPLACE FUNCTION public.get_device_settings(p_device_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_settings JSONB;
    v_child_id UUID;
    v_parent_id UUID;
    v_blocked_apps JSONB;
    v_app_policies JSONB;
    v_schedules JSONB;
    v_shabbat_row RECORD;
    v_computed_shabbat RECORD;
    v_start_epoch bigint;
    v_end_epoch bigint;
    v_base_limit INT;
    v_bonus_minutes INT;
    v_reward RECORD;
    v_issur_windows JSONB;
BEGIN
    SELECT child_id INTO v_child_id FROM devices WHERE device_id = p_device_id;
    IF v_child_id IS NOT NULL THEN
        SELECT parent_id INTO v_parent_id FROM children WHERE id = v_child_id;
    END IF;
    
    SELECT row_to_json(s.*)::jsonb INTO v_settings
    FROM settings s
    WHERE s.device_id = p_device_id
    LIMIT 1;
    
    IF v_settings IS NULL AND v_child_id IS NOT NULL THEN
        SELECT row_to_json(s.*)::jsonb INTO v_settings
        FROM settings s
        WHERE s.child_id = v_child_id AND s.device_id IS NULL
        LIMIT 1;
    END IF;
    
    IF v_settings IS NULL AND v_parent_id IS NOT NULL THEN
        SELECT row_to_json(s.*)::jsonb INTO v_settings
        FROM settings s
        WHERE s.parent_id = v_parent_id AND s.child_id IS NULL AND s.device_id IS NULL
        LIMIT 1;
    END IF;
    
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
    
    IF v_child_id IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(ap.package_name), '[]'::jsonb)
        INTO v_blocked_apps
        FROM app_policies ap
        WHERE ap.child_id = v_child_id AND ap.is_blocked = true;

        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'package_name', ap.package_name,
            'policy_status', CASE WHEN ap.is_blocked THEN 'blocked' ELSE 'approved' END,
            'daily_limit_minutes', null,
            'always_allowed', ap.always_allowed
          )
        ), '[]'::jsonb)
        INTO v_app_policies
        FROM app_policies ap
        WHERE ap.child_id = v_child_id;
        
        v_settings := v_settings || jsonb_build_object(
          'blocked_apps', v_blocked_apps,
          'app_policies', v_app_policies
        );
    END IF;

    IF v_child_id IS NOT NULL THEN
        v_base_limit := (v_settings->>'daily_screen_time_limit_minutes')::int;
        
        IF v_base_limit IS NOT NULL THEN
            SELECT COALESCE(SUM(bonus_minutes), 0) INTO v_bonus_minutes
            FROM bonus_time_grants
            WHERE child_id = v_child_id
              AND grant_date = (now() AT TIME ZONE 'Asia/Jerusalem')::date;
            
            v_settings := v_settings || jsonb_build_object(
                'effective_screen_time_limit_minutes', v_base_limit + v_bonus_minutes,
                'bonus_minutes_today', v_bonus_minutes
            );
        END IF;
    END IF;

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

        -- Get static shabbat zmanim (Jerusalem fallback)
        SELECT sz.* INTO v_shabbat_row
        FROM shabbat_zmanim sz
        WHERE sz.friday_date >= CURRENT_DATE
        ORDER BY sz.friday_date
        LIMIT 1;

        -- Try computed (location-based) shabbat times first
        SELECT * INTO v_computed_shabbat
        FROM shabbat_times_computed stc
        WHERE stc.child_id = v_child_id
          AND stc.friday_date >= CURRENT_DATE
        ORDER BY stc.friday_date
        LIMIT 1;

        IF v_computed_shabbat IS NOT NULL THEN
          v_start_epoch := v_computed_shabbat.start_epoch_ms;
          v_end_epoch := v_computed_shabbat.end_epoch_ms;

          v_settings := v_settings || jsonb_build_object(
            'next_shabbat', jsonb_build_object(
              'friday_date', v_computed_shabbat.friday_date,
              'candle_lighting', COALESCE(v_shabbat_row.candle_lighting, '00:00:00'::time),
              'havdalah', COALESCE(v_shabbat_row.havdalah, '00:00:00'::time),
              'shabbat_start_epoch_ms', v_start_epoch,
              'shabbat_end_epoch_ms', v_end_epoch
            )
          );
        ELSIF v_shabbat_row IS NOT NULL THEN
          v_start_epoch := (EXTRACT(EPOCH FROM (
            (v_shabbat_row.friday_date + v_shabbat_row.candle_lighting) AT TIME ZONE 'Asia/Jerusalem'
          )) * 1000)::bigint;
          v_end_epoch := (EXTRACT(EPOCH FROM (
            ((v_shabbat_row.friday_date + 1) + v_shabbat_row.havdalah) AT TIME ZONE 'Asia/Jerusalem'
          )) * 1000)::bigint;

          v_settings := v_settings || jsonb_build_object(
            'next_shabbat', jsonb_build_object(
              'friday_date', v_shabbat_row.friday_date,
              'candle_lighting', v_shabbat_row.candle_lighting,
              'havdalah', v_shabbat_row.havdalah,
              'shabbat_start_epoch_ms', v_start_epoch,
              'shabbat_end_epoch_ms', v_end_epoch
            )
          );
        END IF;

        -- Issur Melacha Windows (shabbat + yom tov)
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'lock_type', imw.lock_type,
            'event_name', imw.event_name,
            'event_key', imw.event_key,
            'start_epoch_ms', imw.start_epoch_ms,
            'end_epoch_ms', imw.end_epoch_ms
          ) ORDER BY imw.start_epoch_ms
        ), '[]'::jsonb)
        INTO v_issur_windows
        FROM (
          SELECT * FROM issur_melacha_windows
          WHERE child_id = v_child_id
            AND is_active = true
            AND end_epoch_ms > (EXTRACT(EPOCH FROM now()) * 1000)::bigint
          ORDER BY start_epoch_ms
          LIMIT 10
        ) imw;

        v_settings := v_settings || jsonb_build_object('issur_melacha_windows', v_issur_windows);

        v_settings := v_settings || jsonb_build_object('schedule_windows', v_schedules);

        -- Reward bank + streak
        SELECT balance_minutes, current_streak
        INTO v_reward
        FROM reward_bank
        WHERE child_id = v_child_id;

        IF v_reward IS NOT NULL THEN
          v_settings := v_settings || jsonb_build_object(
            'reward_balance_minutes', v_reward.balance_minutes,
            'current_streak', v_reward.current_streak
          );
        ELSE
          v_settings := v_settings || jsonb_build_object(
            'reward_balance_minutes', 0,
            'current_streak', 0
          );
        END IF;
    END IF;
    
    RETURN v_settings;
END;
$$;
