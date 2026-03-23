## Final Alignment Pass — Findings & Plan

### What Was Checked

All 7 AI tables, all 6 RPCs, seed data in `ai_policy_config` and `ai_rollout_flags`, default column values, and function signatures.

---

### ISSUE FOUND — Duplicate `report_ai_incident_summary` (PRIVACY LEAK)

There are **two overloaded versions** of `report_ai_incident_summary` in `public` schema:


| OID            | Has Privacy Hardening                                  | Stores Raw Snippets | Caps `why_short` |
| -------------- | ------------------------------------------------------ | ------------------- | ---------------- |
| 121456 (newer) | Yes — forced `[]`, `LEFT(...,500)`                     | No                  | Yes              |
| 121452 (older) | **No** — passes through `p_evidence_snippets` directly | **Yes**             | **No**           |


The older function has a different parameter order and defaults (e.g., `p_chat_type DEFAULT 'private'`, `p_risk_type DEFAULT 'unknown_contact'`). Depending on how Android calls the RPC (named vs positional args), Postgres could route to the **unhardened** version.

**Fix**: Drop the old overload (oid 121452). Only the hardened version stays.

```sql
DROP FUNCTION IF EXISTS public.report_ai_incident_summary(
  text, uuid, text, text, text, text, text, text, 
  double precision, text, jsonb, jsonb, boolean
);

```

---

### Everything Else — Verified Clean


| Check                                | Status | Detail                                                                                                                                                       |
| ------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Engine names in seed data**        | OK     | `mlkit_speech`, `local_bundled_asr`, `litert_local`, `mlkit_genai`, `heuristic` — exact match                                                                |
| **Engine status defaults**           | OK     | `voice_engine_status` and `slm_engine_status` default to `'unknown'` — matches `healthy/degraded/unavailable/unknown` enum                                   |
| **No non-standard statuses in RPCs** | OK     | RPCs accept freeform text, no conflicting defaults or hardcoded values                                                                                       |
| `get_active_ai_config` **shape**     | OK     | Returns `{policy, rollout}` with correct fallback defaults including exact engine names                                                                      |
| `preferred_voice_engine_order`       | OK     | `["mlkit_speech","local_bundled_asr"]`                                                                                                                       |
| `preferred_slm_engine_order`         | OK     | `["litert_local","mlkit_genai","heuristic"]`                                                                                                                 |
| `feature_flags`                      | OK     | All 5 flags present, all `false`                                                                                                                             |
| `model_metadata`                     | OK     | `policy_schema: v2`, `incident_schema: v1`, correct model refs                                                                                               |
| `escalation_thresholds`              | OK     | `low_to_medium: 0.55`, `medium_to_high: 0.8`, force types correct                                                                                            |
| **Single active row**                | OK     | 1 active in `ai_policy_config`, 1 active in `ai_rollout_flags`                                                                                               |
| **Privacy hardening (hardened RPC)** | OK     | `evidence_snippets` forced to `[]`, `why_short` capped to 500                                                                                                |
| **No raw content fields**            | OK     | No table stores raw chat text                                                                                                                                |
| **Other RPCs — no duplicates**       | OK     | `get_active_ai_config`, `upsert_device_ai_profile`, `report_ai_telemetry`, `upsert_ai_engine_health`, `report_ai_suppression_event` all have single versions |
| **Telemetry/health tables empty**    | OK     | No data yet — no stale values to clean                                                                                                                       |


---

### Migration (1 fix only)

Single migration: drop the old unhardened overload of `report_ai_incident_summary`.

**Accepted engine names (frozen)**:

- Voice: `mlkit_speech`, `local_bundled_asr`
- SLM: `litert_local`, `mlkit_genai`, `heuristic`

**Accepted engine statuses**: `healthy`, `degraded`, `unavailable`, `unknown`

### Files Changed


| File                          | Change                           |
| ----------------------------- | -------------------------------- |
| `supabase/migrations/new.sql` | `DROP FUNCTION` for old overload |


No UI changes. No new tables. No new features. No Android changes.