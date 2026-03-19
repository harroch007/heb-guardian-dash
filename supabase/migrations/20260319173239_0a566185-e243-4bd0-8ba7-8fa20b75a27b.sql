
-- MISSION 3: Streak fields + updated approve_chore + updated get_device_settings

-- Add streak fields to reward_bank
ALTER TABLE public.reward_bank
  ADD COLUMN IF NOT EXISTS current_streak int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_streak_date date;

-- Replace approve_chore with streak logic
CREATE OR REPLACE FUNCTION public.approve_chore(p_chore_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_chore RECORD;
  v_today date;
  v_last_date date;
  v_current_streak int;
BEGIN
  SELECT * INTO v_chore FROM chores
  WHERE id = p_chore_id AND parent_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CHORE_NOT_FOUND');
  END IF;

  IF v_chore.status != 'completed_by_child' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS');
  END IF;

  UPDATE chores SET status = 'approved', approved_at = now() WHERE id = p_chore_id;

  -- Upsert reward bank
  INSERT INTO reward_bank (child_id, balance_minutes, updated_at)
  VALUES (v_chore.child_id, v_chore.reward_minutes, now())
  ON CONFLICT (child_id)
  DO UPDATE SET
    balance_minutes = reward_bank.balance_minutes + v_chore.reward_minutes,
    updated_at = now();

  -- Log transaction
  INSERT INTO reward_transactions (child_id, amount_minutes, source, chore_id)
  VALUES (v_chore.child_id, v_chore.reward_minutes, 'chore_approved', p_chore_id);

  -- Streak logic
  v_today := (now() AT TIME ZONE 'Asia/Jerusalem')::date;

  SELECT last_streak_date, current_streak
  INTO v_last_date, v_current_streak
  FROM reward_bank WHERE child_id = v_chore.child_id;

  IF v_last_date IS NULL OR v_last_date < v_today - 1 THEN
    -- No streak or gap > 1 day: reset to 1
    UPDATE reward_bank
    SET current_streak = 1, last_streak_date = v_today
    WHERE child_id = v_chore.child_id;
  ELSIF v_last_date = v_today - 1 THEN
    -- Consecutive day: increment
    UPDATE reward_bank
    SET current_streak = v_current_streak + 1, last_streak_date = v_today
    WHERE child_id = v_chore.child_id;
  END IF;
  -- If v_last_date = v_today, don't change (already counted today)

  -- If recurring, create next instance
  IF v_chore.is_recurring THEN
    INSERT INTO chores (child_id, parent_id, title, reward_minutes, is_recurring, recurrence_days, status)
    VALUES (v_chore.child_id, v_chore.parent_id, v_chore.title, v_chore.reward_minutes, true, v_chore.recurrence_days, 'pending');
  END IF;

  RETURN jsonb_build_object('success', true, 'reward_minutes', v_chore.reward_minutes);
END;
$$;

-- Replace get_device_settings to include streak + balance
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
    v_app_policies JSONB;
    v_schedules JSONB;
    v_shabbat_row RECORD;
    v_base_limit INT;
    v_bonus_minutes INT;
    v_reward RECORD;
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
