
DO $$
DECLARE
  v_parent_id uuid;
  v_child_id uuid := gen_random_uuid();
  v_device_id text := 'roi-demo-' || substr(md5(random()::text), 1, 12);
  v_today date := ((now() AT TIME ZONE 'Asia/Jerusalem'))::date;
BEGIN
  SELECT id INTO v_parent_id FROM public.parents WHERE email = 'yarivtm@gmail.com' LIMIT 1;
  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION 'Parent yarivtm@gmail.com not found';
  END IF;

  -- Child
  INSERT INTO public.children (id, parent_id, name, gender, date_of_birth, phone_number, subscription_tier)
  VALUES (v_child_id, v_parent_id, 'רואי', 'male', '2013-05-14', '', 'free');

  -- Device (Tel Aviv coordinates)
  INSERT INTO public.devices (device_id, child_id, last_seen, battery_level, latitude, longitude, address, device_model, device_manufacturer, first_seen_at, created_at)
  VALUES (v_device_id, v_child_id, now() - interval '3 minutes', 78, 32.0853, 34.7818, 'דיזנגוף 99, תל אביב', 'Galaxy A54', 'Samsung', now() - interval '14 days', now());

  -- App usage (today)
  INSERT INTO public.app_usage (child_id, device_id, package_name, app_name, usage_minutes, usage_date) VALUES
    (v_child_id, v_device_id, 'com.google.android.youtube', 'YouTube', 47, v_today),
    (v_child_id, v_device_id, 'com.instagram.android', 'Instagram', 32, v_today),
    (v_child_id, v_device_id, 'com.whatsapp', 'WhatsApp', 28, v_today),
    (v_child_id, v_device_id, 'com.android.chrome', 'Chrome', 19, v_today),
    (v_child_id, v_device_id, 'com.zhiliaoapp.musically', 'TikTok', 14, v_today);

  -- App policies
  INSERT INTO public.app_policies (child_id, package_name, app_name, is_blocked, always_allowed, policy_status) VALUES
    (v_child_id, 'com.google.android.youtube', 'YouTube', false, false, 'approved'),
    (v_child_id, 'com.instagram.android', 'Instagram', false, false, 'approved'),
    (v_child_id, 'com.whatsapp', 'WhatsApp', false, true, 'approved'),
    (v_child_id, 'com.android.chrome', 'Chrome', false, false, 'approved'),
    (v_child_id, 'com.zhiliaoapp.musically', 'TikTok', true, false, 'approved'),
    (v_child_id, 'com.android.dialer', 'טלפון', false, true, 'approved'),
    (v_child_id, 'com.google.android.apps.messaging', 'הודעות', false, true, 'approved'),
    (v_child_id, 'com.snapchat.android', 'Snapchat', true, false, 'approved');

  -- Chores
  INSERT INTO public.chores (parent_id, child_id, title, reward_minutes, status, completed_at, approved_at) VALUES
    (v_parent_id, v_child_id, 'לסדר את החדר', 15, 'pending', NULL, NULL),
    (v_parent_id, v_child_id, 'להוציא את הזבל', 10, 'completed_by_child', now() - interval '2 hours', NULL),
    (v_parent_id, v_child_id, 'שיעורי בית', 20, 'approved', now() - interval '5 hours', now() - interval '4 hours');

  -- Bonus time
  INSERT INTO public.bonus_time_grants (child_id, bonus_minutes, grant_date, granted_by)
  VALUES (v_child_id, 15, v_today, v_parent_id);

  -- Geofence settings
  INSERT INTO public.child_geofence_settings (child_id, home_exit_alert_enabled, school_exit_alert_enabled, exit_debounce_seconds)
  VALUES (v_child_id, true, true, 120);

  -- Home place
  INSERT INTO public.child_places (child_id, place_type, label, latitude, longitude, radius_meters, is_active, alert_on_enter, alert_on_exit, schedule_mode)
  VALUES (v_child_id, 'HOME', 'בית', 32.0853, 34.7818, 150, true, false, true, 'ALWAYS');

  -- Settings (daily limit)
  INSERT INTO public.settings (child_id, daily_screen_time_limit_minutes)
  VALUES (v_child_id, 180);

  -- Reward bank
  INSERT INTO public.reward_bank (child_id, balance_minutes)
  VALUES (v_child_id, 35);
END $$;
