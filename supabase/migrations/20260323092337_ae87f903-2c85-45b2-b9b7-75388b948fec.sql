
-- Fix 1: Add updated_at triggers (idempotent)
DROP TRIGGER IF EXISTS set_updated_at_device_ai_profiles ON device_ai_profiles;
CREATE TRIGGER set_updated_at_device_ai_profiles BEFORE UPDATE ON device_ai_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_ai_policy_config ON ai_policy_config;
CREATE TRIGGER set_updated_at_ai_policy_config BEFORE UPDATE ON ai_policy_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_ai_rollout_flags ON ai_rollout_flags;
CREATE TRIGGER set_updated_at_ai_rollout_flags BEFORE UPDATE ON ai_rollout_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_ai_engine_health ON ai_engine_health;
CREATE TRIGGER set_updated_at_ai_engine_health BEFORE UPDATE ON ai_engine_health
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_ai_incident_summaries ON ai_incident_summaries;
CREATE TRIGGER set_updated_at_ai_incident_summaries BEFORE UPDATE ON ai_incident_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fix 2: Change 3 void RPCs to return jsonb
DROP FUNCTION IF EXISTS public.upsert_ai_engine_health(text, uuid, text, text, text, text, integer, integer, integer, integer, text);

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
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  RETURN jsonb_build_object('success', true);
END;
$function$;

DROP FUNCTION IF EXISTS public.report_ai_incident_summary(text, uuid, text, text, text, text, text, text, double precision, text, jsonb, jsonb, boolean);

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
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  RETURN jsonb_build_object('success', true);
END;
$function$;

DROP FUNCTION IF EXISTS public.report_ai_suppression_event(text, uuid, text, text, text, text, text, timestamptz);

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
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  RETURN jsonb_build_object('success', true);
END;
$function$;
