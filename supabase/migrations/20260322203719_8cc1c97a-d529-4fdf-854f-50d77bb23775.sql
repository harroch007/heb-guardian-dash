
-- Create the updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Table 1: ai_incident_summaries
CREATE TABLE public.ai_incident_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  child_id uuid REFERENCES children(id) ON DELETE SET NULL,
  chat_id text NOT NULL,
  chat_type text NOT NULL,
  risk_type text NOT NULL,
  severity text NOT NULL,
  child_role text,
  incident_action text NOT NULL,
  confidence double precision,
  why_short text,
  evidence_message_ids jsonb DEFAULT '[]'::jsonb,
  evidence_snippets jsonb DEFAULT '[]'::jsonb,
  is_open boolean DEFAULT true,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_incident_summaries_device ON public.ai_incident_summaries (device_id, created_at DESC);
CREATE INDEX idx_ai_incident_summaries_child ON public.ai_incident_summaries (child_id, created_at DESC);
CREATE INDEX idx_ai_incident_summaries_chat_open ON public.ai_incident_summaries (chat_id, is_open);
CREATE INDEX idx_ai_incident_summaries_risk ON public.ai_incident_summaries (risk_type, severity, created_at DESC);

ALTER TABLE public.ai_incident_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ai_incident_summaries"
  ON public.ai_incident_summaries FOR SELECT
  TO authenticated
  USING (is_admin());

-- Table 2: ai_engine_health
CREATE TABLE public.ai_engine_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE REFERENCES devices(device_id) ON DELETE CASCADE,
  child_id uuid REFERENCES children(id) ON DELETE SET NULL,
  selected_voice_engine text,
  selected_slm_engine text,
  voice_engine_status text DEFAULT 'unknown',
  slm_engine_status text DEFAULT 'unknown',
  last_voice_latency_ms integer,
  last_slm_latency_ms integer,
  voice_failure_count integer DEFAULT 0,
  slm_failure_count integer DEFAULT 0,
  last_failure_reason text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_engine_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ai_engine_health"
  ON public.ai_engine_health FOR SELECT
  TO authenticated
  USING (is_admin());

-- Table 3: ai_suppression_audit
CREATE TABLE public.ai_suppression_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  child_id uuid,
  chat_id text NOT NULL,
  risk_type text NOT NULL,
  suppression_reason text NOT NULL,
  previous_severity text,
  current_severity text,
  last_alert_sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_suppression_audit_device ON public.ai_suppression_audit (device_id, created_at DESC);
CREATE INDEX idx_ai_suppression_audit_chat ON public.ai_suppression_audit (chat_id, created_at DESC);

ALTER TABLE public.ai_suppression_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ai_suppression_audit"
  ON public.ai_suppression_audit FOR SELECT
  TO authenticated
  USING (is_admin());

-- Triggers
CREATE TRIGGER update_ai_incident_summaries_updated_at
  BEFORE UPDATE ON public.ai_incident_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_engine_health_updated_at
  BEFORE UPDATE ON public.ai_engine_health
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RPC 1: upsert_ai_engine_health
CREATE OR REPLACE FUNCTION public.upsert_ai_engine_health(
  p_device_id text,
  p_child_id uuid DEFAULT NULL,
  p_selected_voice_engine text DEFAULT NULL,
  p_selected_slm_engine text DEFAULT NULL,
  p_voice_engine_status text DEFAULT 'unknown',
  p_slm_engine_status text DEFAULT 'unknown',
  p_last_voice_latency_ms integer DEFAULT NULL,
  p_last_slm_latency_ms integer DEFAULT NULL,
  p_voice_failure_count integer DEFAULT 0,
  p_slm_failure_count integer DEFAULT 0,
  p_last_failure_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
BEGIN
  v_child_id := p_child_id;
  IF v_child_id IS NULL THEN
    SELECT child_id INTO v_child_id FROM devices WHERE device_id = p_device_id;
  END IF;

  INSERT INTO ai_engine_health (
    device_id, child_id, selected_voice_engine, selected_slm_engine,
    voice_engine_status, slm_engine_status,
    last_voice_latency_ms, last_slm_latency_ms,
    voice_failure_count, slm_failure_count,
    last_failure_reason, updated_at
  ) VALUES (
    p_device_id, v_child_id, p_selected_voice_engine, p_selected_slm_engine,
    p_voice_engine_status, p_slm_engine_status,
    p_last_voice_latency_ms, p_last_slm_latency_ms,
    p_voice_failure_count, p_slm_failure_count,
    p_last_failure_reason, now()
  )
  ON CONFLICT (device_id) DO UPDATE SET
    child_id = EXCLUDED.child_id,
    selected_voice_engine = EXCLUDED.selected_voice_engine,
    selected_slm_engine = EXCLUDED.selected_slm_engine,
    voice_engine_status = EXCLUDED.voice_engine_status,
    slm_engine_status = EXCLUDED.slm_engine_status,
    last_voice_latency_ms = EXCLUDED.last_voice_latency_ms,
    last_slm_latency_ms = EXCLUDED.last_slm_latency_ms,
    voice_failure_count = EXCLUDED.voice_failure_count,
    slm_failure_count = EXCLUDED.slm_failure_count,
    last_failure_reason = EXCLUDED.last_failure_reason,
    updated_at = now();
END;
$$;

-- RPC 2: report_ai_incident_summary
CREATE OR REPLACE FUNCTION public.report_ai_incident_summary(
  p_device_id text,
  p_child_id uuid DEFAULT NULL,
  p_chat_id text DEFAULT NULL,
  p_chat_type text DEFAULT 'private',
  p_risk_type text DEFAULT 'unknown_contact',
  p_severity text DEFAULT 'low',
  p_child_role text DEFAULT NULL,
  p_incident_action text DEFAULT 'new',
  p_confidence double precision DEFAULT NULL,
  p_why_short text DEFAULT NULL,
  p_evidence_message_ids jsonb DEFAULT '[]'::jsonb,
  p_evidence_snippets jsonb DEFAULT '[]'::jsonb,
  p_is_open boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_id uuid;
BEGIN
  v_child_id := p_child_id;
  IF v_child_id IS NULL THEN
    SELECT child_id INTO v_child_id FROM devices WHERE device_id = p_device_id;
  END IF;

  IF p_incident_action = 'new' THEN
    INSERT INTO ai_incident_summaries (
      device_id, child_id, chat_id, chat_type, risk_type, severity,
      child_role, incident_action, confidence, why_short,
      evidence_message_ids, evidence_snippets, is_open,
      last_seen_at, created_at, updated_at
    ) VALUES (
      p_device_id, v_child_id, p_chat_id, p_chat_type, p_risk_type, p_severity,
      p_child_role, p_incident_action, p_confidence, p_why_short,
      p_evidence_message_ids, p_evidence_snippets, p_is_open,
      now(), now(), now()
    );
  ELSIF p_incident_action = 'continue' THEN
    UPDATE ai_incident_summaries SET
      severity = p_severity,
      child_role = COALESCE(p_child_role, child_role),
      incident_action = 'continue',
      confidence = COALESCE(p_confidence, confidence),
      why_short = COALESCE(p_why_short, why_short),
      evidence_message_ids = p_evidence_message_ids,
      evidence_snippets = p_evidence_snippets,
      last_seen_at = now(),
      updated_at = now()
    WHERE device_id = p_device_id
      AND chat_id = p_chat_id
      AND risk_type = p_risk_type
      AND is_open = true;

    IF NOT FOUND THEN
      INSERT INTO ai_incident_summaries (
        device_id, child_id, chat_id, chat_type, risk_type, severity,
        child_role, incident_action, confidence, why_short,
        evidence_message_ids, evidence_snippets, is_open,
        last_seen_at, created_at, updated_at
      ) VALUES (
        p_device_id, v_child_id, p_chat_id, p_chat_type, p_risk_type, p_severity,
        p_child_role, 'new', p_confidence, p_why_short,
        p_evidence_message_ids, p_evidence_snippets, true,
        now(), now(), now()
      );
    END IF;
  ELSIF p_incident_action = 'close' THEN
    UPDATE ai_incident_summaries SET
      is_open = false,
      incident_action = 'close',
      last_seen_at = now(),
      updated_at = now()
    WHERE device_id = p_device_id
      AND chat_id = p_chat_id
      AND risk_type = p_risk_type
      AND is_open = true;
  END IF;
END;
$$;

-- RPC 3: report_ai_suppression_event
CREATE OR REPLACE FUNCTION public.report_ai_suppression_event(
  p_device_id text,
  p_child_id uuid DEFAULT NULL,
  p_chat_id text DEFAULT NULL,
  p_risk_type text DEFAULT NULL,
  p_suppression_reason text DEFAULT NULL,
  p_previous_severity text DEFAULT NULL,
  p_current_severity text DEFAULT NULL,
  p_last_alert_sent_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO ai_suppression_audit (
    device_id, child_id, chat_id, risk_type,
    suppression_reason, previous_severity, current_severity,
    last_alert_sent_at, created_at
  ) VALUES (
    p_device_id, p_child_id, p_chat_id, p_risk_type,
    p_suppression_reason, p_previous_severity, p_current_severity,
    p_last_alert_sent_at, now()
  );
END;
$$;

-- Update active ai_policy_config with Phase 2 settings
UPDATE public.ai_policy_config
SET
  feature_flags = jsonb_build_object(
    'enable_local_slm', false,
    'enable_voice_transcription', false,
    'enable_incident_reporting', false,
    'enable_suppression_audit', false,
    'enable_group_analysis', false
  ),
  escalation_thresholds = jsonb_build_object(
    'low_to_medium_min_score', 0.55,
    'medium_to_high_min_score', 0.8,
    'high_risk_force_alert_types', jsonb_build_array('grooming', 'sexual', 'self_harm')
  ),
  model_metadata = jsonb_build_object(
    'slm_model', 'litert_local_v1',
    'voice_model', 'mlkit_speech_v1',
    'policy_schema', 'v2',
    'incident_schema', 'v1'
  ),
  updated_at = now()
WHERE is_active = true;
