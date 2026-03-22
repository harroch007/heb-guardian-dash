## AI Infrastructure — Phase 1: Config, Telemetry, Rollout, Device Profile

### Single Migration with 4 Tables + 3 RPCs

All created in one migration file.

---

### Table 1: `device_ai_profiles`

Device-level AI capability profile, upserted by the device on each sync.


| Column                | Type                                                                 | Notes                                                                                     |
| --------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| id                    | uuid PK default gen_random_uuid()                                    | &nbsp;                                                                                    |
| device_id             | text NOT NULL UNIQUE references devices(device_id) ON DELETE CASCADE | &nbsp;                                                                                    |
| child_id              | uuid references children(id) ON DELETE SET NULL                      | nullable, can be derived from `devices` if needed                                         |
| selected_voice_engine | text                                                                 | must use exact shared engine names only: `"mlkit_speech"`, `"local_bundled_asr"`          |
| selected_slm_engine   | text                                                                 | must use exact shared engine names only: `"litert_local"`, `"mlkit_genai"`, `"heuristic"` |
| device_tier           | text default 'unknown'                                               | `"low"`, `"mid"`, `"high"`, `"unknown"`                                                   |
| voice_supported       | boolean default false                                                | &nbsp;                                                                                    |
| slm_supported         | boolean default false                                                | &nbsp;                                                                                    |
| supports_aicore       | boolean default false                                                | keep false unless device/runtime confirms it explicitly                                   |
| last_health_check_at  | timestamptz                                                          | should be updated on every profile upsert                                                 |
| last_failure_reason   | text                                                                 | &nbsp;                                                                                    |
| created_at            | timestamptz default now()                                            | &nbsp;                                                                                    |
| updated_at            | timestamptz default now()                                            | &nbsp;                                                                                    |


Index on `child_id`. RLS: service-role only (no anon/direct device access, device calls via RPCs with SECURITY DEFINER). `updated_at` must be refreshed on every upsert.

---

### Table 2: `ai_policy_config`

Central AI policy configuration, admin-managed. Versioned rows, only one `is_active = true`.


| Column                       | Type                              | Notes                                                                        |
| ---------------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| id                           | uuid PK default gen_random_uuid() | &nbsp;                                                                       |
| active_policy_version        | text NOT NULL                     | e.g. `"v1.0"`                                                                |
| context_window_size          | integer default 20                | must start at 20 to align with the Android/local AI architecture             |
| suppression_minutes          | integer default 30                | &nbsp;                                                                       |
| escalation_thresholds        | jsonb default '{}'                | &nbsp;                                                                       |
| preferred_voice_engine_order | jsonb default '[]'                | must use exact names only, e.g. `["mlkit_speech","local_bundled_asr"]`       |
| preferred_slm_engine_order   | jsonb default '[]'                | must use exact names only, e.g. `["litert_local","mlkit_genai","heuristic"]` |
| model_metadata               | jsonb default '{}'                | version info, checksums, model names — skeleton for future                   |
| feature_flags                | jsonb default '{}'                | &nbsp;                                                                       |
| is_active                    | boolean default false             | &nbsp;                                                                       |
| created_at                   | timestamptz default now()         | &nbsp;                                                                       |
| updated_at                   | timestamptz default now()         | &nbsp;                                                                       |


Unique partial index on `is_active = true` to enforce single active policy. RLS: admin read, service-role write. `updated_at` should refresh on updates.

---

### Table 3: `ai_rollout_flags`

Remote feature kill-switches. Single active row pattern (same as policy).


| Column                     | Type                              | Notes  |
| -------------------------- | --------------------------------- | ------ |
| id                         | uuid PK default gen_random_uuid() | &nbsp; |
| enable_local_slm           | boolean default false             | &nbsp; |
| enable_voice_transcription | boolean default false             | &nbsp; |
| force_heuristic_mode       | boolean default false             | &nbsp; |
| disable_voice_on_low_end   | boolean default true              | &nbsp; |
| disable_slm_on_low_end     | boolean default true              | &nbsp; |
| notes                      | text                              | &nbsp; |
| is_active                  | boolean default false             | &nbsp; |
| created_at                 | timestamptz default now()         | &nbsp; |
| updated_at                 | timestamptz default now()         | &nbsp; |


Unique partial index on `is_active = true`. RLS: admin read, service-role write. `updated_at` should refresh on updates.

---

### Table 4: `ai_runtime_telemetry`

Append-only operational telemetry. No raw content.


| Column             | Type                              | Notes                                                                          |
| ------------------ | --------------------------------- | ------------------------------------------------------------------------------ |
| id                 | uuid PK default gen_random_uuid() | &nbsp;                                                                         |
| device_id          | text NOT NULL                     | &nbsp;                                                                         |
| child_id           | uuid                              | &nbsp;                                                                         |
| engine_type        | text NOT NULL                     | must use exact shared names: `"voice"`, `"slm"`, `"heuristic"`, `"capability"` |
| event_type         | text NOT NULL                     | `"inference"`, `"fallback"`, `"error"`, `"health_check"`, `"profile_sync"`     |
| latency_ms         | integer                           | &nbsp;                                                                         |
| success            | boolean default true              | &nbsp;                                                                         |
| fallback_triggered | boolean default false             | &nbsp;                                                                         |
| failure_reason     | text                              | &nbsp;                                                                         |
| model_version      | text                              | &nbsp;                                                                         |
| created_at         | timestamptz default now()         | &nbsp;                                                                         |


Index on `(device_id, created_at)`. No FK on `device_id` (telemetry should never fail due to FK). RLS: service-role insert only, admin/service-role read.

---

### RPCs (3 SECURITY DEFINER functions)

**1.** `upsert_device_ai_profile` — device reports its AI capabilities

```id="1a1g7v"
(p_device_id, p_child_id, p_selected_voice_engine, p_selected_slm_engine,
 p_device_tier, p_voice_supported, p_slm_supported, p_supports_aicore,
 p_last_failure_reason)

```

Upserts into `device_ai_profiles` on `device_id` conflict, sets `last_health_check_at = now()`, updates `updated_at = now()`, and if `p_child_id` is null tries to resolve `child_id` from `devices.device_id`.

Important:

- do not normalize to custom engine names
- store exactly the shared names agreed with Android:
  - voice: `mlkit_speech`, `local_bundled_asr`
  - slm: `litert_local`, `mlkit_genai`, `heuristic`

**2.** `get_active_ai_config` — device pulls active policy + rollout flags in one call

```id="bt6z0q"
RETURNS jsonb

```

Returns `{ policy: {...}, rollout: {...} }` from the active rows only. If no active row exists, returns safe defaults rather than null.

**3.** `report_ai_telemetry` — device reports a telemetry event

```id="3er4mn"
(p_device_id, p_child_id, p_engine_type, p_event_type, p_latency_ms,
 p_success, p_fallback_triggered, p_failure_reason, p_model_version)

```

Simple INSERT into `ai_runtime_telemetry`.

---

### Seed Data

- One default `ai_policy_config` row with `is_active = true`, version `"v1.0"`
- One default `ai_rollout_flags` row with `is_active = true`, all features off (safe default)
- Default `context_window_size`: `20`
- Default `preferred_voice_engine_order`: `["mlkit_speech","local_bundled_asr"]`
- Default `preferred_slm_engine_order`: `["litert_local","mlkit_genai","heuristic"]`

### Model/Version Metadata

Handled via `model_metadata` jsonb field in `ai_policy_config` — no separate table needed at this stage. Can store:

```id="lfgu07"
{
  "slm_model": "litert_local_v1",
  "voice_model": "mlkit_speech_v1",
  "policy_schema": "v1"
}

```

### What stays untouched

- No UI changes
- No Android behavior changes
- No alerting flow changes
- No raw content stored anywhere
- Existing `get_device_settings` unchanged

### Files changed


| File                          | Change                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `supabase/migrations/new.sql` | All 4 tables, 3 RPCs, indexes, RLS policies, partial unique indexes, seed data |


### Manual Verification

```id="4tlmvw"
-- Check active rows exist
SELECT * FROM ai_policy_config WHERE is_active = true;
SELECT * FROM ai_rollout_flags WHERE is_active = true;

-- Test profile upsert
SELECT upsert_device_ai_profile('test123', null, 'mlkit_speech', 'litert_local', 'high', true, true, false, null);
SELECT * FROM device_ai_profiles WHERE device_id = 'test123';

-- Test config pull
SELECT get_active_ai_config();

-- Test telemetry insert
SELECT report_ai_telemetry('test123', null, 'slm', 'health_check', 250, true, false, null, 'v1');
SELECT * FROM ai_runtime_telemetry WHERE device_id = 'test123' ORDER BY created_at DESC;

```