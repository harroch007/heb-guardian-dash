
-- =============================================
-- 1. טבלת app_alerts
-- =============================================
CREATE TABLE public.app_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id text NOT NULL REFERENCES public.devices(device_id),
  child_id uuid,
  package_name text NOT NULL,
  app_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_alerts_device_created ON public.app_alerts (device_id, created_at);
CREATE INDEX idx_app_alerts_child ON public.app_alerts (child_id);

ALTER TABLE public.app_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devices can insert app alerts"
  ON public.app_alerts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Parents can view their children app alerts"
  ON public.app_alerts FOR SELECT
  USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

CREATE POLICY "Admins can view all app alerts"
  ON public.app_alerts FOR SELECT
  USING (is_admin());

-- =============================================
-- 2. טבלת nightly_usage_reports
-- =============================================
CREATE TABLE public.nightly_usage_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id text NOT NULL REFERENCES public.devices(device_id),
  child_id uuid,
  total_minutes integer NOT NULL,
  top_app_package text,
  top_app_name text,
  top_app_minutes integer,
  report_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, report_date)
);

CREATE INDEX idx_nightly_usage_child_date ON public.nightly_usage_reports (child_id, report_date);

ALTER TABLE public.nightly_usage_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devices can insert nightly usage reports"
  ON public.nightly_usage_reports FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Parents can view their children nightly usage"
  ON public.nightly_usage_reports FOR SELECT
  USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

CREATE POLICY "Admins can view all nightly usage"
  ON public.nightly_usage_reports FOR SELECT
  USING (is_admin());

-- =============================================
-- 3. RPC: create_app_alert
-- =============================================
CREATE OR REPLACE FUNCTION public.create_app_alert(
  p_device_id text,
  p_package_name text,
  p_app_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_child_id uuid;
  v_id uuid;
BEGIN
  SELECT child_id INTO v_child_id FROM devices WHERE device_id = p_device_id;

  INSERT INTO app_alerts (device_id, child_id, package_name, app_name)
  VALUES (p_device_id, v_child_id, p_package_name, p_app_name)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- =============================================
-- 4. RPC: report_nightly_usage
-- =============================================
CREATE OR REPLACE FUNCTION public.report_nightly_usage(
  p_device_id text,
  p_total_minutes integer,
  p_top_app_package text DEFAULT NULL,
  p_top_app_name text DEFAULT NULL,
  p_top_app_minutes integer DEFAULT NULL,
  p_report_date date DEFAULT (now() AT TIME ZONE 'Asia/Jerusalem')::date
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_child_id uuid;
  v_id uuid;
BEGIN
  SELECT child_id INTO v_child_id FROM devices WHERE device_id = p_device_id;

  INSERT INTO nightly_usage_reports (device_id, child_id, total_minutes, top_app_package, top_app_name, top_app_minutes, report_date)
  VALUES (p_device_id, v_child_id, p_total_minutes, p_top_app_package, p_top_app_name, p_top_app_minutes, p_report_date)
  ON CONFLICT (device_id, report_date)
  DO UPDATE SET
    total_minutes = EXCLUDED.total_minutes,
    top_app_package = EXCLUDED.top_app_package,
    top_app_name = EXCLUDED.top_app_name,
    top_app_minutes = EXCLUDED.top_app_minutes,
    child_id = COALESCE(EXCLUDED.child_id, nightly_usage_reports.child_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
