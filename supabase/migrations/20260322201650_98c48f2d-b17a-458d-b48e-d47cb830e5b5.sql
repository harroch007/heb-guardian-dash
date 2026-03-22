
-- ============================================================
-- AI Infrastructure Phase 1: Config, Telemetry, Rollout, Device Profile
-- ============================================================

-- Table 1: device_ai_profiles
CREATE TABLE public.device_ai_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE REFERENCES public.devices(device_id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.children(id) ON DELETE SET NULL,
  selected_voice_engine text,
  selected_slm_engine text,
  device_tier text DEFAULT 'unknown',
  voice_supported boolean DEFAULT false,
  slm_supported boolean DEFAULT false,
  supports_aicore boolean DEFAULT false,
  last_health_check_at timestamptz,
  last_failure_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_device_ai_profiles_child_id ON public.device_ai_profiles(child_id);
ALTER TABLE public.device_ai_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read device_ai_profiles" ON public.device_ai_profiles FOR SELECT TO authenticated USING (public.is_admin());

-- Table 2: ai_policy_config
CREATE TABLE public.ai_policy_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_policy_version text NOT NULL,
  context_window_size integer DEFAULT 20,
  suppression_minutes integer DEFAULT 30,
  escalation_thresholds jsonb DEFAULT '{}',
  preferred_voice_engine_order jsonb DEFAULT '[]',
  preferred_slm_engine_order jsonb DEFAULT '[]',
  model_metadata jsonb DEFAULT '{}',
  feature_flags jsonb DEFAULT '{}',
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX idx_ai_policy_config_single_active ON public.ai_policy_config (is_active) WHERE is_active = true;
ALTER TABLE public.ai_policy_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read ai_policy_config" ON public.ai_policy_config FOR SELECT TO authenticated USING (public.is_admin());

-- Table 3: ai_rollout_flags
CREATE TABLE public.ai_rollout_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enable_local_slm boolean DEFAULT false,
  enable_voice_transcription boolean DEFAULT false,
  force_heuristic_mode boolean DEFAULT false,
  disable_voice_on_low_end boolean DEFAULT true,
  disable_slm_on_low_end boolean DEFAULT true,
  notes text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX idx_ai_rollout_flags_single_active ON public.ai_rollout_flags (is_active) WHERE is_active = true;
ALTER TABLE public.ai_rollout_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read ai_rollout_flags" ON public.ai_rollout_flags FOR SELECT TO authenticated USING (public.is_admin());

-- Table 4: ai_runtime_telemetry
CREATE TABLE public.ai_runtime_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  child_id uuid,
  engine_type text NOT NULL,
  event_type text NOT NULL,
  latency_ms integer,
  success boolean DEFAULT true,
  fallback_triggered boolean DEFAULT false,
  failure_reason text,
  model_version text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_ai_runtime_telemetry_device_created ON public.ai_runtime_telemetry(device_id, created_at);
ALTER TABLE public.ai_runtime_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read ai_runtime_telemetry" ON public.ai_runtime_telemetry FOR SELECT TO authenticated USING (public.is_admin());

-- updated_at triggers
CREATE TRIGGER set_updated_at_device_ai_profiles BEFORE UPDATE ON public.device_ai_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_ai_policy_config BEFORE UPDATE ON public.ai_policy_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_ai_rollout_flags BEFORE UPDATE ON public.ai_rollout_flags FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RPC 1: upsert_device_ai_profile
CREATE OR REPLACE FUNCTION public.upsert_device_ai_profile(
  p_device_id text,
  p_child_id uuid DEFAULT NULL,
  p_selected_voice_engine text DEFAULT NULL,
  p_selected_slm_engine text DEFAULT NULL,
  p_device_tier text DEFAULT 'unknown',
  p_voice_supported boolean DEFAULT false,
  p_slm_supported boolean DEFAULT false,
  p_supports_aicore boolean DEFAULT false,
  p_last_failure_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_child_id uuid;
BEGIN
  v_child_id := p_child_id;
  IF v_child_id IS NULL THEN
    SELECT child_id INTO v_child_id FROM devices WHERE device_id = p_device_id;
  END IF;
  INSERT INTO device_ai_profiles (device_id, child_id, selected_voice_engine, selected_slm_engine, device_tier, voice_supported, slm_supported, supports_aicore, last_health_check_at, last_failure_reason)
  VALUES (p_device_id, v_child_id, p_selected_voice_engine, p_selected_slm_engine, p_device_tier, p_voice_supported, p_slm_supported, p_supports_aicore, now(), p_last_failure_reason)
  ON CONFLICT (device_id) DO UPDATE SET
    child_id = COALESCE(EXCLUDED.child_id, device_ai_profiles.child_id),
    selected_voice_engine = EXCLUDED.selected_voice_engine,
    selected_slm_engine = EXCLUDED.selected_slm_engine,
    device_tier = EXCLUDED.device_tier,
    voice_supported = EXCLUDED.voice_supported,
    slm_supported = EXCLUDED.slm_supported,
    supports_aicore = EXCLUDED.supports_aicore,
    last_health_check_at = now(),
    last_failure_reason = EXCLUDED.last_failure_reason,
    updated_at = now();
  RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC 2: get_active_ai_config
CREATE OR REPLACE FUNCTION public.get_active_ai_config()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_policy jsonb; v_rollout jsonb;
BEGIN
  SELECT jsonb_build_object(
    'active_policy_version', active_policy_version, 'context_window_size', context_window_size,
    'suppression_minutes', suppression_minutes, 'escalation_thresholds', escalation_thresholds,
    'preferred_voice_engine_order', preferred_voice_engine_order, 'preferred_slm_engine_order', preferred_slm_engine_order,
    'model_metadata', model_metadata, 'feature_flags', feature_flags
  ) INTO v_policy FROM ai_policy_config WHERE is_active = true LIMIT 1;

  SELECT jsonb_build_object(
    'enable_local_slm', enable_local_slm, 'enable_voice_transcription', enable_voice_transcription,
    'force_heuristic_mode', force_heuristic_mode, 'disable_voice_on_low_end', disable_voice_on_low_end,
    'disable_slm_on_low_end', disable_slm_on_low_end
  ) INTO v_rollout FROM ai_rollout_flags WHERE is_active = true LIMIT 1;

  IF v_policy IS NULL THEN
    v_policy := jsonb_build_object('active_policy_version','v1.0','context_window_size',20,'suppression_minutes',30,
      'escalation_thresholds','{}','preferred_voice_engine_order','["mlkit_speech","local_bundled_asr"]'::jsonb,
      'preferred_slm_engine_order','["litert_local","mlkit_genai","heuristic"]'::jsonb,'model_metadata','{}','feature_flags','{}');
  END IF;
  IF v_rollout IS NULL THEN
    v_rollout := jsonb_build_object('enable_local_slm',false,'enable_voice_transcription',false,
      'force_heuristic_mode',false,'disable_voice_on_low_end',true,'disable_slm_on_low_end',true);
  END IF;

  RETURN jsonb_build_object('policy', v_policy, 'rollout', v_rollout);
END;
$$;

-- RPC 3: report_ai_telemetry
CREATE OR REPLACE FUNCTION public.report_ai_telemetry(
  p_device_id text, p_child_id uuid DEFAULT NULL, p_engine_type text DEFAULT 'heuristic',
  p_event_type text DEFAULT 'health_check', p_latency_ms integer DEFAULT NULL,
  p_success boolean DEFAULT true, p_fallback_triggered boolean DEFAULT false,
  p_failure_reason text DEFAULT NULL, p_model_version text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO ai_runtime_telemetry (device_id, child_id, engine_type, event_type, latency_ms, success, fallback_triggered, failure_reason, model_version)
  VALUES (p_device_id, p_child_id, p_engine_type, p_event_type, p_latency_ms, p_success, p_fallback_triggered, p_failure_reason, p_model_version);
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Seed data
INSERT INTO public.ai_policy_config (active_policy_version, context_window_size, suppression_minutes, preferred_voice_engine_order, preferred_slm_engine_order, model_metadata, is_active)
VALUES ('v1.0', 20, 30, '["mlkit_speech","local_bundled_asr"]'::jsonb, '["litert_local","mlkit_genai","heuristic"]'::jsonb, '{"slm_model":"litert_local_v1","voice_model":"mlkit_speech_v1","policy_schema":"v1"}'::jsonb, true);

INSERT INTO public.ai_rollout_flags (enable_local_slm, enable_voice_transcription, force_heuristic_mode, disable_voice_on_low_end, disable_slm_on_low_end, is_active, notes)
VALUES (false, false, false, true, true, true, 'Initial safe defaults — all AI features off');
