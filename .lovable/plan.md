## AI Infrastructure — Phase 2: Incident Summaries, Engine Health, Suppression Audit

### Single migration creating 3 tables + 3 RPCs + policy config update

---

### Tables

**1.** `ai_incident_summaries` — Summary-only incident storage (no raw content)

- Key columns: `device_id` (FK), `child_id` (FK), `chat_id`, `chat_type`, `risk_type`, `severity`, `child_role`, `incident_action`, `confidence`, `why_short`, `evidence_message_ids` (jsonb), `evidence_snippets` (jsonb, short snippets only), `is_open`, `last_seen_at`
- 4 indexes: `(device_id, created_at desc)`, `(child_id, created_at desc)`, `(chat_id, is_open)`, `(risk_type, severity, created_at desc)`
- RLS: admin + service-role read, no anon access, service-role write only via RPC
- `updated_at` trigger

**2.** `ai_engine_health` — Per-device engine runtime health (UNIQUE on device_id)

- Key columns: `device_id` (FK, UNIQUE), `child_id` (FK), `selected_voice_engine`, `selected_slm_engine`, engine statuses, latencies, failure counts, `last_failure_reason`
- Engine names must use exact shared names only:
  - voice: `mlkit_speech`, `local_bundled_asr`
  - slm: `litert_local`, `mlkit_genai`, `heuristic`
- RLS: admin + service-role read, no anon access, service-role write only via RPC
- `updated_at` trigger

**3.** `ai_suppression_audit` — Append-only suppression log (no raw content)

- Key columns: `device_id`, `child_id`, `chat_id`, `risk_type`, `suppression_reason`, `previous_severity`, `current_severity`, `last_alert_sent_at`
- 2 indexes: `(device_id, created_at desc)`, `(chat_id, created_at desc)`
- No FK on device_id (same pattern as telemetry — audit should never fail on FK)
- RLS: admin + service-role read, no anon access, service-role insert only via RPC

### RPCs (SECURITY DEFINER)

**1.** `upsert_ai_engine_health` — Upsert on `device_id` conflict, refresh `updated_at`. Resolves `child_id` from `devices` if null.

**2.** `report_ai_incident_summary` — Smart insert/update/close:

- `"new"` → INSERT new row
- `"continue"` → UPDATE existing open incident matching `(device_id, chat_id, risk_type, is_open=true)`, refresh `last_seen_at`
- `"close"` → SET `is_open=false` on matching open incident
- Store only structured summary data, never raw message bodies or long chat excerpts

**3.** `report_ai_suppression_event` — Simple INSERT into `ai_suppression_audit`

### Seed data update

UPDATE the active `ai_policy_config` row:

- keep `context_window_size = 20`
- keep engine order aligned with Android:
  - `preferred_voice_engine_order`: `["mlkit_speech","local_bundled_asr"]`
  - `preferred_slm_engine_order`: `["litert_local","mlkit_genai","heuristic"]`
- `feature_flags`: add `enable_incident_reporting`, `enable_suppression_audit`, `enable_group_analysis` (all `false`)
- `escalation_thresholds`: set `low_to_medium_min_score: 0.55`, `medium_to_high_min_score: 0.8`, `high_risk_force_alert_types: ["grooming","sexual","self_harm"]`
- `model_metadata`: update `policy_schema` to `"v2"`, add `incident_schema: "v1"`

### What stays untouched

- No UI changes
- No raw content stored
- Phase 1 tables/RPCs unchanged
- `get_device_settings` unchanged
- Android unchanged

### Files changed


| File                          | Change                                                         |
| ----------------------------- | -------------------------------------------------------------- |
| `supabase/migrations/new.sql` | 3 tables, 3 RPCs, indexes, RLS, triggers, policy config update |
