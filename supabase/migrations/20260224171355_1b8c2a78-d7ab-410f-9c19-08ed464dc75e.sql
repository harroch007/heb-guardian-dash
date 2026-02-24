
-- Part 1: Delete the orphan settings row (parent_id IS NULL) for this child
DELETE FROM settings 
WHERE child_id = '6233e88a-0212-4682-a350-442681e95a5f' 
  AND device_id IS NULL 
  AND parent_id IS NULL;

-- Part 2: Replace the view with a LATERAL join to prevent future duplicates
CREATE OR REPLACE VIEW parent_alerts_effective AS
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
    (d.device_id IS NOT NULL AND now() < (COALESCE(d.first_seen_at, d.created_at) + interval '72 hours')) AS is_in_warmup,
    COALESCE(
        s.alert_threshold,
        CASE
            WHEN d.device_id IS NOT NULL AND now() < (COALESCE(d.first_seen_at, d.created_at) + interval '72 hours') THEN 80
            ELSE 60
        END
    ) AS effective_threshold
FROM alerts a
LEFT JOIN devices d ON d.device_id = a.device_id
LEFT JOIN LATERAL (
    SELECT s1.alert_threshold
    FROM settings s1
    WHERE s1.child_id = a.child_id
      AND s1.device_id IS NULL
    ORDER BY s1.parent_id IS NOT NULL DESC, s1.updated_at DESC NULLS LAST
    LIMIT 1
) s ON true
WHERE 
    (a.alert_type = 'warning' AND a.ai_verdict = 'notify' 
     AND a.ai_risk_score IS NOT NULL 
     AND a.ai_risk_score >= COALESCE(
         s.alert_threshold,
         CASE
             WHEN d.device_id IS NOT NULL AND now() < (COALESCE(d.first_seen_at, d.created_at) + interval '72 hours') THEN 80
             ELSE 60
         END
     ))
    OR (a.alert_type = 'positive' AND a.is_processed = true);

-- Part 3: Drop the old partial unique index and create a broader one
DROP INDEX IF EXISTS uq_settings_child_no_device;

-- New index: one settings row per (parent_id, child_id) where device_id IS NULL
-- Uses COALESCE to also cover parent_id IS NULL rows
CREATE UNIQUE INDEX uq_settings_child_no_device 
ON settings (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), child_id) 
WHERE device_id IS NULL;
