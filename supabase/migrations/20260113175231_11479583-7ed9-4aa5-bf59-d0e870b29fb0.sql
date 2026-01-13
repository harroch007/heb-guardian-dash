-- STEP 1: Add first_seen_at column to devices
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS first_seen_at timestamptz;

-- STEP 2: Backfill first_seen_at from created_at where NULL
UPDATE public.devices
SET first_seen_at = created_at
WHERE first_seen_at IS NULL;

-- STEP 3: Drop and recreate view with new column names
DROP VIEW IF EXISTS public.parent_alerts_effective;

CREATE VIEW public.parent_alerts_effective AS
SELECT 
    a.id,
    a.created_at,
    a.content,
    a.risk_score,
    a.sender,
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
    a.sender_display,
    a.acknowledged_at,
    a.expert_type,
    a.remind_at,
    a.child_role,
    a.author_type,
    a.chat_name,
    COALESCE(d.first_seen_at, d.created_at) AS warmup_start,
    now() - COALESCE(d.first_seen_at, d.created_at) AS device_age,
    (d.device_id IS NOT NULL AND now() < (COALESCE(d.first_seen_at, d.created_at) + interval '72 hours')) AS is_in_warmup,
    CASE
        WHEN d.device_id IS NOT NULL AND now() < (COALESCE(d.first_seen_at, d.created_at) + interval '72 hours') THEN 80
        ELSE 60
    END AS effective_threshold
FROM public.alerts a
LEFT JOIN public.devices d ON d.device_id = a.device_id
WHERE 
    a.ai_verdict = 'notify'
    AND a.ai_risk_score IS NOT NULL
    AND (
        (d.device_id IS NOT NULL 
         AND now() < (COALESCE(d.first_seen_at, d.created_at) + interval '72 hours') 
         AND a.ai_risk_score >= 80)
        OR
        (d.device_id IS NOT NULL 
         AND now() >= (COALESCE(d.first_seen_at, d.created_at) + interval '72 hours') 
         AND a.ai_risk_score >= 60)
        OR
        (d.device_id IS NULL AND a.ai_risk_score >= 60)
    );