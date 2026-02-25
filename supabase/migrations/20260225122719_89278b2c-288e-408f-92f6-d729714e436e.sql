CREATE OR REPLACE VIEW public.parent_alerts_effective
WITH (security_invoker=on) AS
SELECT a.id,
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
    ((d.device_id IS NOT NULL) AND (now() < (COALESCE(d.first_seen_at, d.created_at) + '72:00:00'::interval))) AS is_in_warmup,
    COALESCE(s.alert_threshold,
        CASE
            WHEN ((d.device_id IS NOT NULL) AND (now() < (COALESCE(d.first_seen_at, d.created_at) + '72:00:00'::interval))) THEN 80
            ELSE 60
        END) AS effective_threshold
   FROM ((alerts a
     LEFT JOIN devices d ON ((d.device_id = a.device_id)))
     LEFT JOIN LATERAL ( SELECT s1.alert_threshold
           FROM settings s1
          WHERE ((s1.child_id = a.child_id) AND (s1.device_id IS NULL))
          ORDER BY (s1.parent_id IS NOT NULL) DESC, s1.updated_at DESC NULLS LAST
         LIMIT 1) s ON (true))
  WHERE (((a.alert_type = 'warning'::text) AND (a.ai_verdict = 'notify'::text) AND (a.ai_risk_score IS NOT NULL) AND (a.ai_risk_score >= COALESCE(s.alert_threshold,
        CASE
            WHEN ((d.device_id IS NOT NULL) AND (now() < (COALESCE(d.first_seen_at, d.created_at) + '72:00:00'::interval))) THEN 80
            ELSE 60
        END))) OR ((a.alert_type = 'positive'::text) AND (a.is_processed = true)));