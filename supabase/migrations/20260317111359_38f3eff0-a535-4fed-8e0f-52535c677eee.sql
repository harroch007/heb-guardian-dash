-- Fix parent_daily_report view: replace all UTC with Asia/Jerusalem
CREATE OR REPLACE VIEW public.parent_daily_report AS
WITH base AS (
  SELECT d.device_id,
    d.child_id,
    (now() AT TIME ZONE 'Asia/Jerusalem')::date AS report_date,
    now() < (COALESCE(d.first_seen_at, d.created_at) + '72:00:00'::interval) AS is_in_warmup,
    CASE
      WHEN now() < (COALESCE(d.first_seen_at, d.created_at) + '72:00:00'::interval) THEN 80
      ELSE 60
    END AS effective_threshold
  FROM devices d
), health AS (
  SELECT ddh.device_id,
    ddh.check_date,
    ddh.checks_sent,
    ddh.checks_responded,
    ddh.last_response_at
  FROM device_daily_health ddh
  WHERE ddh.check_date = (now() AT TIME ZONE 'Asia/Jerusalem')::date
), usage_sum AS (
  SELECT au.device_id,
    au.usage_date,
    sum(au.usage_minutes)::integer AS total_usage_minutes
  FROM app_usage au
  WHERE au.usage_date = (now() AT TIME ZONE 'Asia/Jerusalem')::date
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
), usage_top AS (
  SELECT au.device_id,
    au.usage_date,
    jsonb_agg(jsonb_build_object('package_name', au.package_name, 'app_name', au.app_name, 'usage_minutes', au.usage_minutes) ORDER BY au.usage_minutes DESC) AS top_apps
  FROM app_usage au
  WHERE au.usage_date = (now() AT TIME ZONE 'Asia/Jerusalem')::date
  GROUP BY au.device_id, au.usage_date
), alerts_today AS (
  SELECT a.device_id,
    (a.analyzed_at AT TIME ZONE 'Asia/Jerusalem')::date AS day,
    count(*) FILTER (WHERE a.ai_verdict = 'safe') AS cnt_safe,
    count(*) FILTER (WHERE a.ai_verdict = 'review') AS cnt_review,
    count(*) FILTER (WHERE a.ai_verdict = 'notify') AS cnt_notify
  FROM alerts a
  WHERE a.analyzed_at IS NOT NULL
    AND (a.analyzed_at AT TIME ZONE 'Asia/Jerusalem')::date = (now() AT TIME ZONE 'Asia/Jerusalem')::date
    AND a.alert_type = 'warning'
  GROUP BY a.device_id, (a.analyzed_at AT TIME ZONE 'Asia/Jerusalem')::date
), notify_effective_today AS (
  SELECT pae.device_id,
    (pae.analyzed_at AT TIME ZONE 'Asia/Jerusalem')::date AS day,
    count(*) AS cnt_notify_effective
  FROM parent_alerts_effective pae
  WHERE pae.analyzed_at IS NOT NULL
    AND (pae.analyzed_at AT TIME ZONE 'Asia/Jerusalem')::date = (now() AT TIME ZONE 'Asia/Jerusalem')::date
    AND pae.alert_type = 'warning'
  GROUP BY pae.device_id, (pae.analyzed_at AT TIME ZONE 'Asia/Jerusalem')::date
)
SELECT b.report_date,
  b.device_id,
  b.child_id,
  b.is_in_warmup,
  b.effective_threshold,
  h.checks_sent,
  h.checks_responded,
  h.last_response_at,
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

-- Fix get_parent_daily_report_for_parent: UTC → Asia/Jerusalem in alert CTEs
CREATE OR REPLACE FUNCTION public.get_parent_daily_report_for_parent(p_report_date date)
 RETURNS TABLE(report_date date, device_id text, child_id uuid, is_in_warmup boolean, effective_threshold integer, checks_sent integer, checks_responded integer, last_response_at timestamp with time zone, total_usage_minutes integer, top_apps jsonb, cnt_safe bigint, cnt_review bigint, cnt_notify bigint, cnt_notify_effective integer)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
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
  SELECT a.child_id, (a.created_at AT TIME ZONE 'Asia/Jerusalem')::date AS day,
    count(*) FILTER (WHERE a.ai_verdict='safe') AS cnt_safe,
    count(*) FILTER (WHERE a.ai_verdict='review') AS cnt_review,
    count(*) FILTER (WHERE a.ai_verdict='notify') AS cnt_notify
  FROM alerts a
  WHERE (a.created_at AT TIME ZONE 'Asia/Jerusalem')::date = p_report_date
  GROUP BY a.child_id, (a.created_at AT TIME ZONE 'Asia/Jerusalem')::date
),
notify_effective AS (
  SELECT pae.child_id, (pae.created_at AT TIME ZONE 'Asia/Jerusalem')::date AS day,
    count(*)::integer AS cnt_notify_effective
  FROM parent_alerts_effective pae
  WHERE (pae.created_at AT TIME ZONE 'Asia/Jerusalem')::date = p_report_date
  GROUP BY pae.child_id, (pae.created_at AT TIME ZONE 'Asia/Jerusalem')::date
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
$function$;

-- Fix add_daily_metrics: UTC → Asia/Jerusalem for default metric_date
CREATE OR REPLACE FUNCTION public.add_daily_metrics(p_device_id text, p_messages_delta integer DEFAULT 0, p_ai_delta integer DEFAULT 0, p_alerts_delta integer DEFAULT 0, p_metric_date date DEFAULT ((now() AT TIME ZONE 'Asia/Jerusalem'::text))::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.device_daily_metrics (device_id, metric_date, messages_scanned, stacks_sent_to_ai, alerts_sent)
  values (p_device_id, p_metric_date, greatest(p_messages_delta,0), greatest(p_ai_delta,0), greatest(p_alerts_delta,0))
  on conflict (device_id, metric_date)
  do update set
    messages_scanned   = public.device_daily_metrics.messages_scanned   + greatest(excluded.messages_scanned,0),
    stacks_sent_to_ai  = public.device_daily_metrics.stacks_sent_to_ai  + greatest(excluded.stacks_sent_to_ai,0),
    alerts_sent        = public.device_daily_metrics.alerts_sent        + greatest(excluded.alerts_sent,0),
    updated_at         = now();

  return jsonb_build_object('success', true);
end;
$function$;

-- Fix trigger functions: UTC → Asia/Jerusalem
CREATE OR REPLACE FUNCTION public.trg_ai_stack_request_to_daily_metrics()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  perform public.add_daily_metrics(
    new.device_id,
    0,
    1,
    0,
    (new.created_at at time zone 'Asia/Jerusalem')::date
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trg_alert_insert_to_daily_metrics()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_metric_date date;
begin
  v_metric_date := (new.created_at at time zone 'Asia/Jerusalem')::date;

  if coalesce(new.risk_score, 0) >= 60 then
    perform public.add_daily_metrics(
      new.device_id,
      0,
      0,
      1,
      v_metric_date
    );
  end if;

  return new;
end;
$function$;