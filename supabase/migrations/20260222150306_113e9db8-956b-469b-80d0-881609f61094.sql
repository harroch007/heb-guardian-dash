
-- Add alert_type column to alerts table
ALTER TABLE public.alerts 
ADD COLUMN alert_type text NOT NULL DEFAULT 'warning';

-- Add index for filtering by alert_type
CREATE INDEX idx_alerts_alert_type ON public.alerts (alert_type);

-- Drop the view chain (CASCADE will drop dependents)
DROP VIEW IF EXISTS public.parent_home_snapshot CASCADE;
DROP VIEW IF EXISTS public.parent_daily_report_for_parent CASCADE;
DROP VIEW IF EXISTS public.parent_daily_report CASCADE;
DROP VIEW IF EXISTS public.parent_alerts_effective CASCADE;

-- Recreate parent_alerts_effective with alert_type support
CREATE OR REPLACE VIEW public.parent_alerts_effective WITH (security_invoker=on) AS
SELECT
  a.id,
  a.created_at,
  a.content,
  a.risk_score,
  a.sender,
  a.sender_display,
  a.ai_summary,
  a.ai_recommendation,
  a.is_processed,
  a.device_id,
  a.chat_type,
  a.message_count,
  a.ai_analysis,
  a.ai_verdict,
  a.ai_risk_score,
  a.ai_confidence,
  a.ai_classification,
  a.ai_explanation,
  a.ai_explanation_short,
  a.ai_recommendation_short,
  a.ai_patterns,
  a.should_store,
  a.escalate,
  a.analyzed_at,
  a.child_id,
  a.source,
  a.should_alert,
  a.parent_message,
  a.suggested_action,
  a.category,
  a.acknowledged_at,
  a.expert_type,
  a.remind_at,
  a.child_role,
  a.author_type,
  a.chat_name,
  a.alert_type,
  COALESCE(d.first_seen_at, d.created_at) AS warmup_start,
  ((d.device_id IS NOT NULL) AND (now() < (COALESCE(d.first_seen_at, d.created_at) + interval '72 hours'))) AS is_in_warmup,
  COALESCE(s.alert_threshold,
    CASE
      WHEN ((d.device_id IS NOT NULL) AND (now() < (COALESCE(d.first_seen_at, d.created_at) + interval '72 hours'))) THEN 80
      ELSE 60
    END) AS effective_threshold
FROM alerts a
LEFT JOIN devices d ON d.device_id = a.device_id
LEFT JOIN settings s ON (s.child_id = a.child_id AND s.device_id IS NULL)
WHERE 
  (
    -- Warning alerts: existing logic (notify verdict + threshold)
    (a.alert_type = 'warning' AND a.ai_verdict = 'notify' AND a.ai_risk_score IS NOT NULL 
     AND a.ai_risk_score >= COALESCE(s.alert_threshold,
       CASE
         WHEN ((d.device_id IS NOT NULL) AND (now() < (COALESCE(d.first_seen_at, d.created_at) + interval '72 hours'))) THEN 80
         ELSE 60
       END))
    OR
    -- Positive alerts: all processed positive alerts pass through
    (a.alert_type = 'positive' AND a.is_processed = true)
  );

-- Recreate parent_daily_report
CREATE OR REPLACE VIEW public.parent_daily_report WITH (security_invoker=on) AS
WITH base AS (
  SELECT d.device_id, d.child_id,
    ((now() AT TIME ZONE 'UTC'))::date AS report_date,
    (now() < (COALESCE(d.first_seen_at, d.created_at) + interval '72 hours')) AS is_in_warmup,
    CASE WHEN (now() < (COALESCE(d.first_seen_at, d.created_at) + interval '72 hours')) THEN 80 ELSE 60 END AS effective_threshold
  FROM devices d
), health AS (
  SELECT ddh.device_id, ddh.check_date, ddh.checks_sent, ddh.checks_responded, ddh.last_response_at
  FROM device_daily_health ddh
  WHERE ddh.check_date = ((now() AT TIME ZONE 'UTC'))::date
), usage_sum AS (
  SELECT au.device_id, au.usage_date, sum(au.usage_minutes)::integer AS total_usage_minutes
  FROM app_usage au WHERE au.usage_date = ((now() AT TIME ZONE 'UTC'))::date
  GROUP BY au.device_id, au.usage_date
), usage_top AS (
  SELECT au.device_id, au.usage_date,
    jsonb_agg(jsonb_build_object('package_name', au.package_name, 'app_name', au.app_name, 'usage_minutes', au.usage_minutes) ORDER BY au.usage_minutes DESC) AS top_apps
  FROM app_usage au WHERE au.usage_date = ((now() AT TIME ZONE 'UTC'))::date
  GROUP BY au.device_id, au.usage_date
), alerts_today AS (
  SELECT a.device_id, ((a.analyzed_at AT TIME ZONE 'UTC'))::date AS day,
    count(*) FILTER (WHERE a.ai_verdict = 'safe') AS cnt_safe,
    count(*) FILTER (WHERE a.ai_verdict = 'review') AS cnt_review,
    count(*) FILTER (WHERE a.ai_verdict = 'notify') AS cnt_notify
  FROM alerts a
  WHERE a.analyzed_at IS NOT NULL AND ((a.analyzed_at AT TIME ZONE 'UTC'))::date = ((now() AT TIME ZONE 'UTC'))::date
    AND a.alert_type = 'warning'
  GROUP BY a.device_id, ((a.analyzed_at AT TIME ZONE 'UTC'))::date
), notify_effective_today AS (
  SELECT pae.device_id, ((pae.analyzed_at AT TIME ZONE 'UTC'))::date AS day,
    count(*) AS cnt_notify_effective
  FROM parent_alerts_effective pae
  WHERE pae.analyzed_at IS NOT NULL AND ((pae.analyzed_at AT TIME ZONE 'UTC'))::date = ((now() AT TIME ZONE 'UTC'))::date
    AND pae.alert_type = 'warning'
  GROUP BY pae.device_id, ((pae.analyzed_at AT TIME ZONE 'UTC'))::date
)
SELECT b.report_date, b.device_id, b.child_id, b.is_in_warmup, b.effective_threshold,
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

-- Recreate parent_daily_report_for_parent
CREATE OR REPLACE VIEW public.parent_daily_report_for_parent WITH (security_invoker=on) AS
WITH children_of_parent AS (
  SELECT c.id AS child_id FROM children c WHERE c.parent_id = auth.uid()
), primary_device AS (
  SELECT DISTINCT ON (d.child_id) d.child_id, d.device_id, d.created_at, d.first_seen_at, d.last_seen
  FROM devices d JOIN children_of_parent cp ON cp.child_id = d.child_id
  ORDER BY d.child_id, d.last_seen DESC NULLS LAST, d.created_at DESC
), today AS (
  SELECT ((now() AT TIME ZONE 'UTC'))::date AS report_date
), warmup AS (
  SELECT pd.child_id, pd.device_id,
    (now() < (COALESCE(pd.first_seen_at, pd.created_at) + interval '72 hours')) AS is_in_warmup,
    CASE WHEN (now() < (COALESCE(pd.first_seen_at, pd.created_at) + interval '72 hours')) THEN 80 ELSE 60 END AS effective_threshold
  FROM primary_device pd
), health AS (
  SELECT ddh.device_id, ddh.check_date, ddh.checks_sent, ddh.checks_responded, ddh.last_response_at
  FROM device_daily_health ddh JOIN today t ON t.report_date = ddh.check_date
), usage_sum AS (
  SELECT au.child_id, au.usage_date, sum(au.usage_minutes)::integer AS total_usage_minutes
  FROM app_usage au JOIN today t ON t.report_date = au.usage_date
  GROUP BY au.child_id, au.usage_date
), top_apps AS (
  SELECT au.child_id, au.usage_date,
    jsonb_agg(jsonb_build_object('app_name', au.app_name, 'package_name', au.package_name, 'usage_minutes', au.usage_minutes) ORDER BY au.usage_minutes DESC) AS top_apps
  FROM (
    SELECT au1.*, row_number() OVER (PARTITION BY au1.child_id, au1.usage_date ORDER BY au1.usage_minutes DESC) AS rn
    FROM app_usage au1 JOIN today t ON t.report_date = au1.usage_date
  ) au WHERE au.rn <= 5
  GROUP BY au.child_id, au.usage_date
), alert_counts AS (
  SELECT a.child_id, ((a.analyzed_at AT TIME ZONE 'UTC'))::date AS day,
    count(*) FILTER (WHERE a.ai_verdict = 'safe') AS cnt_safe,
    count(*) FILTER (WHERE a.ai_verdict = 'review') AS cnt_review,
    count(*) FILTER (WHERE a.ai_verdict = 'notify') AS cnt_notify
  FROM alerts a JOIN today t ON t.report_date = ((a.analyzed_at AT TIME ZONE 'UTC'))::date
  WHERE a.analyzed_at IS NOT NULL AND a.alert_type = 'warning'
  GROUP BY a.child_id, ((a.analyzed_at AT TIME ZONE 'UTC'))::date
), notify_effective AS (
  SELECT pae.child_id, ((pae.analyzed_at AT TIME ZONE 'UTC'))::date AS day,
    count(*)::integer AS cnt_notify_effective
  FROM parent_alerts_effective pae JOIN today t ON t.report_date = ((pae.analyzed_at AT TIME ZONE 'UTC'))::date
  WHERE pae.analyzed_at IS NOT NULL AND pae.alert_type = 'warning'
  GROUP BY pae.child_id, ((pae.analyzed_at AT TIME ZONE 'UTC'))::date
)
SELECT t.report_date, pd.device_id, pd.child_id, w.is_in_warmup, w.effective_threshold,
  h.checks_sent, h.checks_responded, h.last_response_at,
  COALESCE(us.total_usage_minutes, 0) AS total_usage_minutes,
  COALESCE(ta.top_apps, '[]'::jsonb) AS top_apps,
  COALESCE(ac.cnt_safe, 0::bigint) AS cnt_safe,
  COALESCE(ac.cnt_review, 0::bigint) AS cnt_review,
  COALESCE(ac.cnt_notify, 0::bigint) AS cnt_notify,
  COALESCE(ne.cnt_notify_effective, 0) AS cnt_notify_effective
FROM today t
JOIN primary_device pd ON true
LEFT JOIN warmup w ON w.child_id = pd.child_id AND w.device_id = pd.device_id
LEFT JOIN health h ON h.device_id = pd.device_id AND h.check_date = t.report_date
LEFT JOIN usage_sum us ON us.child_id = pd.child_id AND us.usage_date = t.report_date
LEFT JOIN top_apps ta ON ta.child_id = pd.child_id AND ta.usage_date = t.report_date
LEFT JOIN alert_counts ac ON ac.child_id = pd.child_id AND ac.day = t.report_date
LEFT JOIN notify_effective ne ON ne.child_id = pd.child_id AND ne.day = t.report_date;

-- Recreate parent_home_snapshot
CREATE OR REPLACE VIEW public.parent_home_snapshot WITH (security_invoker=on) AS
WITH today AS (
  SELECT ((now() AT TIME ZONE 'Asia/Jerusalem'))::date AS day
), children_of_parent AS (
  SELECT c.id AS child_id FROM children c WHERE c.parent_id = auth.uid()
), primary_device AS (
  SELECT DISTINCT ON (d.child_id) d.child_id, d.device_id, d.last_seen, d.battery_level, d.address
  FROM devices d JOIN children_of_parent cp ON cp.child_id = d.child_id
  ORDER BY d.child_id, d.last_seen DESC NULLS LAST, d.created_at DESC
), metrics AS (
  SELECT m.device_id, m.messages_scanned, m.stacks_sent_to_ai, m.alerts_sent
  FROM device_daily_metrics m JOIN today t ON t.day = m.metric_date
), app_usage_sum AS (
  SELECT au.device_id, sum(au.usage_minutes)::integer AS total_usage_minutes
  FROM app_usage au JOIN today t ON t.day = au.usage_date
  GROUP BY au.device_id
), top_apps AS (
  SELECT au.device_id,
    jsonb_agg(jsonb_build_object('app_name', au.app_name, 'package_name', au.package_name, 'usage_minutes', au.usage_minutes) ORDER BY au.usage_minutes DESC) AS top_apps
  FROM app_usage au JOIN today t ON t.day = au.usage_date
  GROUP BY au.device_id
), top_chats AS (
  SELECT dcs.device_id,
    jsonb_agg(jsonb_build_object('chat_name', dcs.chat_name, 'chat_type', dcs.chat_type, 'message_count', dcs.message_count) ORDER BY dcs.message_count DESC) AS top_chats
  FROM daily_chat_stats dcs JOIN today t ON t.day = dcs.stat_date
  GROUP BY dcs.device_id
), notify_effective AS (
  SELECT pae.device_id,
    count(*)::integer AS notify_effective_today,
    max(pae.ai_risk_score) AS max_notify_score
  FROM parent_alerts_effective pae JOIN today t ON ((pae.created_at AT TIME ZONE 'Asia/Jerusalem'))::date = t.day
  WHERE pae.alert_type = 'warning'
  GROUP BY pae.device_id
)
SELECT pd.child_id, c.name AS child_name, pd.device_id, pd.last_seen, pd.battery_level, pd.address,
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
