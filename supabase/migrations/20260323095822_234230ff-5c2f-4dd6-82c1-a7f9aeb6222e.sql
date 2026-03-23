-- Privacy Alignment: force evidence_snippets to [] and cap why_short to 500 chars
CREATE OR REPLACE FUNCTION public.report_ai_incident_summary(
  p_device_id text,
  p_chat_id text,
  p_chat_type text,
  p_risk_type text,
  p_severity text,
  p_incident_action text,
  p_child_id uuid DEFAULT NULL,
  p_child_role text DEFAULT NULL,
  p_confidence double precision DEFAULT NULL,
  p_why_short text DEFAULT NULL,
  p_evidence_message_ids jsonb DEFAULT NULL,
  p_evidence_snippets jsonb DEFAULT NULL,
  p_is_open boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_child_id uuid;
  -- PRIVACY CONTRACT: evidence_snippets is intentionally forced to '[]'::jsonb.
  -- The p_evidence_snippets parameter exists only for backward compatibility
  -- with Android clients. Its value is never stored.
  v_why_short text := LEFT(COALESCE(p_why_short, ''), 500);
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
      p_child_role, p_incident_action, p_confidence, v_why_short,
      p_evidence_message_ids, '[]'::jsonb, p_is_open,
      now(), now(), now()
    );
  ELSIF p_incident_action = 'continue' THEN
    UPDATE ai_incident_summaries SET
      severity = p_severity,
      child_role = COALESCE(p_child_role, child_role),
      incident_action = 'continue',
      confidence = COALESCE(p_confidence, confidence),
      why_short = v_why_short,
      evidence_message_ids = p_evidence_message_ids,
      evidence_snippets = '[]'::jsonb,
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
        p_child_role, 'new', p_confidence, v_why_short,
        p_evidence_message_ids, '[]'::jsonb, true,
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
$$;