-- Exclude infrastructure/launcher packages from screen-time totals

CREATE OR REPLACE VIEW parent_home_snapshot AS
WITH today AS (
  SELECT (now() AT TIME ZONE 'Asia/Jerusalem')::date AS day
),
children_of_parent AS (
  SELECT c.id AS child_id FROM children c WHERE c.parent_id = auth.uid()
),
primary_device AS (
  SELECT DISTINCT ON (d.child_id)
    d.child_id, d.device_id, d.last_seen, d.battery_level, d.address
  FROM devices d
  JOIN children_of_parent cp ON cp.child_id = d.child_id
  ORDER BY d.child_id, d.last_seen DESC NULLS LAST, d.created_at DESC
),
metrics AS (
  SELECT m.device_id, m.messages_scanned, m.stacks_sent_to_ai, m.alerts_sent
  FROM device_daily_metrics m
  JOIN today t ON t.day = m.metric_date
),
app_usage_sum AS (
  SELECT au.device_id, sum(au.usage_minutes)::integer AS total_usage_minutes
  FROM app_usage au
  JOIN today t ON t.day = au.usage_date
  WHERE au.package_name NOT IN (
    'com.sec.android.app.launcher',
    'com.samsung.android.app.launcher',
    'com.miui.home',
    'com.android.launcher',
    'com.android.launcher3',
    'com.huawei.android.launcher',
    'com.oppo.launcher',
    'com.android.systemui',
    'com.google.android.permissioncontroller',
    'com.google.android.gms',
    'com.google.android.gsf'
  )
  GROUP BY au.device_id
),
top_apps AS (
  SELECT au.device_id,
    jsonb_agg(jsonb_build_object('app_name', au.app_name, 'package_name', au.package_name, 'usage_minutes', au.usage_minutes) ORDER BY au.usage_minutes DESC) AS top_apps
  FROM app_usage au
  JOIN today t ON t.day = au.usage_date
  GROUP BY au.device_id
),
top_chats AS (
  SELECT dcs.device_id,
    jsonb_agg(jsonb_build_object('chat_name', dcs.chat_name, 'chat_type', dcs.chat_type, 'message_count', dcs.message_count) ORDER BY dcs.message_count DESC) AS top_chats
  FROM daily_chat_stats dcs
  JOIN today t ON t.day = dcs.stat_date
  GROUP BY dcs.device_id
),
notify_effective AS (
  SELECT pae.device_id,
    count(*)::integer AS notify_effective_today,
    max(pae.ai_risk_score) AS max_notify_score
  FROM parent_alerts_effective pae
  JOIN today t ON (pae.created_at AT TIME ZONE 'Asia/Jerusalem')::date = t.day
  WHERE pae.alert_type = 'warning'
  GROUP BY pae.device_id
)
SELECT
  pd.child_id, c.name AS child_name, pd.device_id, pd.last_seen, pd.battery_level, pd.address,
  COALESCE(mx.messages_scanned, 0) AS messages_scanned,
  COALESCE(mx.stacks_sent_to_ai, 0) AS stacks_sent_to_ai,
  COALESCE(mx.alerts_sent, 0) AS alerts_sent,
  COALESCE(au.total_usage_minutes, 0) AS total_usage_minutes,
  COALESCE(ta.top_apps, '[]'::jsonb) AS top_apps,
  COALESCE(tc.top_chats, '[]'::jsonb) AS top_chats,
  COALESCE(ne.notify_effective_today, 0) AS notify_effective_today,
  ne.max_notify_score
FROM primary_device pd
JOIN children c ON c.id = pd.child_id
LEFT JOIN metrics mx ON mx.device_id = pd.device_id
LEFT JOIN app_usage_sum au ON au.device_id = pd.device_id
LEFT JOIN top_apps ta ON ta.device_id = pd.device_id
LEFT JOIN top_chats tc ON tc.device_id = pd.device_id
LEFT JOIN notify_effective ne ON ne.device_id = pd.device_id;

-- Update parent_daily_report view
CREATE OR REPLACE VIEW parent_daily_report AS
WITH base AS (
  SELECT d.device_id, d.child_id,
    (now() AT TIME ZONE 'UTC')::date AS report_date,
    now() < (COALESCE(d.first_seen_at, d.created_at) + '72:00:00'::interval) AS is_in_warmup,
    CASE WHEN now() < (COALESCE(d.first_seen_at, d.created_at) + '72:00:00'::interval) THEN 80 ELSE 60 END AS effective_threshold
  FROM devices d
),
health AS (
  SELECT ddh.device_id, ddh.check_date, ddh.checks_sent, ddh.checks_responded, ddh.last_response_at
  FROM device_daily_health ddh
  WHERE ddh.check_date = (now() AT TIME ZONE 'UTC')::date
),
usage_sum AS (
  SELECT au.device_id, au.usage_date, sum(au.usage_minutes)::integer AS total_usage_minutes
  FROM app_usage au
  WHERE au.usage_date = (now() AT TIME ZONE 'UTC')::date
    AND au.package_name NOT IN (
      'com.sec.android.app.launcher',
      'com.samsung.android.app.launcher',
      'com.miui.home',
      'com.android.launcher',
      'com.android.launcher3',
      'com.huawei.android.launcher',
      'com.oppo.launcher',
      'com.android.systemui',
      'com.google.android.permissioncontroller',
      'com.google.android.gms',
      'com.google.android.gsf'
    )
  GROUP BY au.device_id, au.usage_date
),
usage_top AS (
  SELECT au.device_id, au.usage_date,
    jsonb_agg(jsonb_build_object('package_name', au.package_name, 'app_name', au.app_name, 'usage_minutes', au.usage_minutes) ORDER BY au.usage_minutes DESC) AS top_apps
  FROM app_usage au
  WHERE au.usage_date = (now() AT TIME ZONE 'UTC')::date
  GROUP BY au.device_id, au.usage_date
),
alerts_today AS (
  SELECT a.device_id, (a.analyzed_at AT TIME ZONE 'UTC')::date AS day,
    count(*) FILTER (WHERE a.ai_verdict = 'safe') AS cnt_safe,
    count(*) FILTER (WHERE a.ai_verdict = 'review') AS cnt_review,
    count(*) FILTER (WHERE a.ai_verdict = 'notify') AS cnt_notify
  FROM alerts a
  WHERE a.analyzed_at IS NOT NULL AND (a.analyzed_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date AND a.alert_type = 'warning'
  GROUP BY a.device_id, (a.analyzed_at AT TIME ZONE 'UTC')::date
),
notify_effective_today AS (
  SELECT pae.device_id, (pae.analyzed_at AT TIME ZONE 'UTC')::date AS day,
    count(*) AS cnt_notify_effective
  FROM parent_alerts_effective pae
  WHERE pae.analyzed_at IS NOT NULL AND (pae.analyzed_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date AND pae.alert_type = 'warning'
  GROUP BY pae.device_id, (pae.analyzed_at AT TIME ZONE 'UTC')::date
)
SELECT
  b.report_date, b.device_id, b.child_id, b.is_in_warmup, b.effective_threshold,
  h.checks_sent, h.checks_responded, h.last_response_at,
  COALESCE(us.total_usage_minutes, 0) AS total_usage_minutes,
  COALESCE(ut.top_apps, '[]'::jsonb) AS top_apps,
  COALESCE(at.cnt_safe, 0::bigint) AS cnt_safe,
  COALESCE(at.cnt_review, 0::bigint) AS cnt_review,
  COALESCE(at.cnt_notify, 0::bigint) AS cnt_notify,
  COALESCE(ne.cnt_notify_effective, 0::bigint) AS cnt_notify_effective
FROM base b
LEFT JOIN health h ON h.device_id = b.device_id AND h.check_date = b.report_date
LEFT JOIN usage_sum us ON us.device_id = b.device_id AND us.usage_date = b.report_date
LEFT JOIN usage_top ut ON ut.device_id = b.device_id AND ut.usage_date = b.report_date
LEFT JOIN alerts_today at ON at.device_id = b.device_id AND at.day = b.report_date
LEFT JOIN notify_effective_today ne ON ne.device_id = b.device_id AND ne.day = b.report_date;

-- Update get_parent_daily_report_for_parent function
CREATE OR REPLACE FUNCTION public.get_parent_daily_report_for_parent(p_report_date date)
 RETURNS TABLE(report_date date, device_id text, child_id uuid, is_in_warmup boolean, effective_threshold integer, checks_sent integer, checks_responded integer, last_response_at timestamp with time zone, total_usage_minutes integer, top_apps jsonb, cnt_safe bigint, cnt_review bigint, cnt_notify bigint, cnt_notify_effective integer)
 LANGUAGE sql
 SET search_path TO 'public'
AS $$
WITH children_of_parent AS (
  SELECT c.id AS child_id FROM children c WHERE c.parent_id = auth.uid()
),
primary_device AS (
  SELECT DISTINCT ON (d.child_id)
    d.child_id, d.device_id, d.created_at, d.first_seen_at, d.last_seen
  FROM devices d
  JOIN children_of_parent cp ON cp.child_id = d.child_id
  ORDER BY d.child_id, d.last_seen DESC NULLS LAST, d.created_at DESC
),
warmup AS (
  SELECT pd.child_id, pd.device_id,
    now() < (COALESCE(pd.first_seen_at, pd.created_at) + interval '72 hours') AS is_in_warmup,
    CASE WHEN now() < (COALESCE(pd.first_seen_at, pd.created_at) + interval '72 hours') THEN 80 ELSE 60 END AS effective_threshold
  FROM primary_device pd
),
health AS (
  SELECT ddh.device_id, ddh.check_date, ddh.checks_sent, ddh.checks_responded, ddh.last_response_at
  FROM device_daily_health ddh
  WHERE ddh.check_date = p_report_date
),
usage_sum AS (
  SELECT au.child_id, au.usage_date, sum(au.usage_minutes)::integer AS total_usage_minutes
  FROM app_usage au
  WHERE au.usage_date = p_report_date
    AND au.package_name NOT IN (
      'com.sec.android.app.launcher',
      'com.samsung.android.app.launcher',
      'com.miui.home',
      'com.android.launcher',
      'com.android.launcher3',
      'com.huawei.android.launcher',
      'com.oppo.launcher',
      'com.android.systemui',
      'com.google.android.permissioncontroller',
      'com.google.android.gms',
      'com.google.android.gsf'
    )
  GROUP BY au.child_id, au.usage_date
),
top_apps AS (
  SELECT au.child_id, au.usage_date,
    jsonb_agg(jsonb_build_object('app_name', au.app_name, 'package_name', au.package_name, 'usage_minutes', au.usage_minutes) ORDER BY au.usage_minutes DESC) AS top_apps
  FROM (
    SELECT au1.*, row_number() OVER (PARTITION BY au1.child_id, au1.usage_date ORDER BY au1.usage_minutes DESC) AS rn
    FROM app_usage au1
    WHERE au1.usage_date = p_report_date
  ) au
  WHERE au.rn <= 5
  GROUP BY au.child_id, au.usage_date
),
alert_counts AS (
  SELECT a.child_id, (a.created_at AT TIME ZONE 'UTC')::date AS day,
    count(*) FILTER (WHERE a.ai_verdict='safe') AS cnt_safe,
    count(*) FILTER (WHERE a.ai_verdict='review') AS cnt_review,
    count(*) FILTER (WHERE a.ai_verdict='notify') AS cnt_notify
  FROM alerts a
  WHERE (a.created_at AT TIME ZONE 'UTC')::date = p_report_date
  GROUP BY a.child_id, (a.created_at AT TIME ZONE 'UTC')::date
),
notify_effective AS (
  SELECT pae.child_id, (pae.created_at AT TIME ZONE 'UTC')::date AS day,
    count(*)::integer AS cnt_notify_effective
  FROM parent_alerts_effective pae
  WHERE (pae.created_at AT TIME ZONE 'UTC')::date = p_report_date
  GROUP BY pae.child_id, (pae.created_at AT TIME ZONE 'UTC')::date
)
SELECT
  p_report_date AS report_date, pd.device_id, pd.child_id, w.is_in_warmup, w.effective_threshold,
  h.checks_sent, h.checks_responded, h.last_response_at,
  COALESCE(us.total_usage_minutes, 0) AS total_usage_minutes,
  COALESCE(ta.top_apps, '[]'::jsonb) AS top_apps,
  COALESCE(ac.cnt_safe, 0) AS cnt_safe,
  COALESCE(ac.cnt_review, 0) AS cnt_review,
  COALESCE(ac.cnt_notify, 0) AS cnt_notify,
  COALESCE(ne.cnt_notify_effective, 0) AS cnt_notify_effective
FROM primary_device pd
LEFT JOIN warmup w ON w.child_id = pd.child_id AND w.device_id = pd.device_id
LEFT JOIN health h ON h.device_id = pd.device_id AND h.check_date = p_report_date
LEFT JOIN usage_sum us ON us.child_id = pd.child_id AND us.usage_date = p_report_date
LEFT JOIN top_apps ta ON ta.child_id = pd.child_id AND ta.usage_date = p_report_date
LEFT JOIN alert_counts ac ON ac.child_id = pd.child_id AND ac.day = p_report_date
LEFT JOIN notify_effective ne ON ne.child_id = pd.child_id AND ne.day = p_report_date;
$$;