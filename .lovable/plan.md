## AI Infrastructure — Phase 2: Incident Summaries, Engine Health, Suppression Audit

### Completed Migration — 3 Tables + 3 RPCs + Policy Update

---

### Table 1: `ai_incident_summaries`

Summary-only incident storage. No raw message content.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| device_id | text NOT NULL FK→devices | |
| child_id | uuid FK→children | nullable |
| chat_id | text NOT NULL | |
| chat_type | text NOT NULL | "private" / "group" |
| risk_type | text NOT NULL | "bullying", "grooming", "sexual", etc. |
| severity | text NOT NULL | "low", "medium", "high" |
| child_role | text | "target", "aggressor", etc. |
| incident_action | text NOT NULL | "new", "continue", "close" |
| confidence | double precision | |
| why_short | text | short explanation only |
| evidence_message_ids | jsonb | message ids only |
| evidence_snippets | jsonb | short snippets only |
| is_open | boolean default true | |
| last_seen_at | timestamptz | |
| created_at / updated_at | timestamptz | |

4 indexes. RLS: admin read only.

### Table 2: `ai_engine_health`

Per-device runtime health snapshot.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| device_id | text NOT NULL UNIQUE FK→devices | |
| child_id | uuid FK→children | |
| selected_voice_engine | text | mlkit_speech, local_bundled_asr |
| selected_slm_engine | text | litert_local, mlkit_genai, heuristic |
| voice/slm_engine_status | text | healthy, degraded, unavailable, unknown |
| last_voice/slm_latency_ms | integer | |
| voice/slm_failure_count | integer | |
| last_failure_reason | text | |
| updated_at | timestamptz | |

RLS: admin read only.

### Table 3: `ai_suppression_audit`

Append-only suppression log. No raw content. No FK on device_id.

2 indexes. RLS: admin read only.

### RPCs (SECURITY DEFINER)

1. `upsert_ai_engine_health` — upsert on device_id conflict
2. `report_ai_incident_summary` — new/continue/close lifecycle
3. `report_ai_suppression_event` — simple INSERT

### Policy Config Updated

- `feature_flags`: added `enable_incident_reporting`, `enable_suppression_audit`, `enable_group_analysis` (all false)
- `escalation_thresholds`: `low_to_medium: 0.55`, `medium_to_high: 0.8`, force alert types: grooming, sexual, self_harm
- `model_metadata`: `policy_schema: v2`, `incident_schema: v1`

### Phase 1 tables/RPCs remain unchanged
