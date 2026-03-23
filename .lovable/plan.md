## AI Infrastructure — Verification & Alignment Report

### Summary: Infrastructure is clean and consistent. Two minor issues found.

---

### 1. Tables/RPCs Checked

All 7 tables and 6 RPCs verified:

- `device_ai_profiles`, `ai_policy_config`, `ai_rollout_flags`, `ai_runtime_telemetry`, `ai_incident_summaries`, `ai_engine_health`, `ai_suppression_audit`
- `get_active_ai_config`, `upsert_device_ai_profile`, `report_ai_telemetry`, `upsert_ai_engine_health`, `report_ai_incident_summary`, `report_ai_suppression_event`

---

### 2. Findings

#### ISSUE 1 — Missing `updated_at` triggers on mutable tables

The function `update_updated_at_column()` exists but **no triggers are attached** to the mutable AI tables. The RPCs handle `updated_at = now()` manually, so RPC-based writes are fine. But any direct service-role UPDATE (e.g. admin editing config) would NOT refresh `updated_at`.

**Fix**: Add `BEFORE UPDATE` triggers on:

- `device_ai_profiles`
- `ai_policy_config`
- `ai_rollout_flags`
- `ai_engine_health`
- `ai_incident_summaries`

(Not needed on append-only tables: `ai_runtime_telemetry`, `ai_suppression_audit`.)

#### ISSUE 2 — Inconsistent RPC success response shape

`upsert_device_ai_profile` and `report_ai_telemetry` return `jsonb` with `{"success": true}`, but `report_ai_incident_summary`, `upsert_ai_engine_health`, and `report_ai_suppression_event` return `void`. Android will need a consistent response shape to confirm writes succeeded.

**Fix**: Change all 3 void RPCs to return `jsonb` with `{"success": true}`.

---

### 3. Everything Verified as Correct


| Check                                                                                                                                                                                                                                                                   | Status |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Naming alignment** — all engine names in seed data, RPCs, and `get_active_ai_config` output use exact standard names (`mlkit_speech`, `local_bundled_asr`, `litert_local`, `mlkit_genai`, `heuristic`)                                                                | OK     |
| **Policy config values** — `context_window_size=20`, `suppression_minutes=30`, correct engine orders, `policy_schema=v2`, `incident_schema=v1`                                                                                                                          | OK     |
| **Feature flags** — `enable_local_slm`, `enable_voice_transcription`, `enable_incident_reporting`, `enable_suppression_audit`, `enable_group_analysis` all `false`                                                                                                      | OK     |
| **Escalation thresholds** — `low_to_medium: 0.55`, `medium_to_high: 0.8`, force types: `grooming, sexual, self_harm`                                                                                                                                                    | OK     |
| `get_active_ai_config()` **shape** — returns `{policy: {...}, rollout: {...}}` with safe defaults if no active row                                                                                                                                                      | OK     |
| **Single active row** — exactly 1 `is_active=true` in `ai_policy_config`, exactly 1 in `ai_rollout_flags`                                                                                                                                                               | OK     |
| **Partial unique indexes** — enforce single-active-row constraint on both tables                                                                                                                                                                                        | OK     |
| **RLS** — all 7 tables have RLS enabled, all use `is_admin()` for SELECT, no anon access, no direct INSERT/UPDATE/DELETE policies (writes go through SECURITY DEFINER RPCs)                                                                                             | OK     |
| **All 6 RPCs** — all `SECURITY DEFINER`                                                                                                                                                                                                                                 | OK     |
| **FK structure** — `device_ai_profiles`, `ai_engine_health`, `ai_incident_summaries` have FKs to `devices` (CASCADE) and `children` (SET NULL). `ai_runtime_telemetry` and `ai_suppression_audit` have no FKs (intentional — append-only audit should never fail on FK) | OK     |
| **No raw content** — no field in any table stores raw chat content. `why_short` is text (short explanation only), `evidence_snippets` is jsonb (short snippets), `evidence_message_ids` is jsonb (IDs only), telemetry has no content fields                            | OK     |
| `report_ai_incident_summary` **lifecycle** — `new`/`continue`/`close` logic correct, `continue` falls back to `new` if no open incident found                                                                                                                           | OK     |
| **child_id resolution** — `upsert_device_ai_profile`, `upsert_ai_engine_health`, `report_ai_incident_summary` all resolve `child_id` from `devices` table when null                                                                                                     | OK     |


---

### 4. Migration Plan (2 fixes only)

Single migration file:

**Fix 1** — Add `updated_at` triggers:

```sql
CREATE TRIGGER set_updated_at_device_ai_profiles BEFORE UPDATE ON device_ai_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_ai_policy_config BEFORE UPDATE ON ai_policy_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_ai_rollout_flags BEFORE UPDATE ON ai_rollout_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_ai_engine_health BEFORE UPDATE ON ai_engine_health
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_ai_incident_summaries BEFORE UPDATE ON ai_incident_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

```

**Fix 2** — Make 3 void RPCs return `jsonb`:

- `upsert_ai_engine_health` → add `RETURN jsonb_build_object('success', true);`
- `report_ai_incident_summary` → add `RETURN jsonb_build_object('success', true);`
- `report_ai_suppression_event` → add `RETURN jsonb_build_object('success', true);`

Replace with `CREATE OR REPLACE FUNCTION ... RETURNS jsonb` for each.

### Files changed


| File                          | Change                               |
| ----------------------------- | ------------------------------------ |
| `supabase/migrations/new.sql` | 5 triggers + 3 RPC return type fixes |


No UI changes. No new tables. No new features. No Android changes.