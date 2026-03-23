-- Final Alignment Pass: drop the old unhardened overload of report_ai_incident_summary
-- This version lacks privacy hardening: it passes through p_evidence_snippets
-- directly and does not cap why_short. Only the hardened version remains.

DROP FUNCTION IF EXISTS public.report_ai_incident_summary(
  text, uuid, text, text, text, text, text, text,
  double precision, text, jsonb, jsonb, boolean
);