## Privacy Alignment — Incident Summaries Hardening

### Current State

The `report_ai_incident_summary` RPC accepts `p_evidence_snippets jsonb` and stores whatever the caller sends directly into `ai_incident_summaries.evidence_snippets`. This means any caller (including Android) could pass raw chat content into this field, violating the privacy-by-default principle.

### What Changes

**Single migration** — modify `report_ai_incident_summary` RPC only:

1. **Force** `evidence_snippets = '[]'::jsonb` in all INSERT and UPDATE paths inside the RPC, regardless of what `p_evidence_snippets` is passed. The parameter stays in the function signature for backward compatibility (Android won't break), but its value is ignored.
2. **Add a SQL comment** inside the function documenting the privacy contract: `evidence_snippets` is intentionally not populated by default.
3. **Normalize** `why_short` **inside the RPC** by storing only a short explanation:
  - use `LEFT(COALESCE(p_why_short, ''), 500)`
  - this prevents `why_short` from being used as a raw content dump
  - do this in both INSERT and UPDATE paths

### What Stays

- `evidence_snippets` column stays in the table (backward compat, no schema break)
- `p_evidence_snippets` parameter stays in the RPC signature (Android compat)
- `evidence_message_ids` continues to store IDs only (already correct)
- `why_short` continues to store short explanations (now capped to 500 chars inside the RPC)
- No UI changes
- No Android changes
- No other RPCs/tables touched

### Privacy Result


| Field                  | Before                       | After                               |
| ---------------------- | ---------------------------- | ----------------------------------- |
| `why_short`            | Uncapped text                | Trimmed to max 500 chars inside RPC |
| `evidence_message_ids` | IDs only (correct)           | Unchanged                           |
| `evidence_snippets`    | Stores whatever caller sends | Always forced to `[]` by RPC        |


### Files Changed


| File                          | Change                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `supabase/migrations/new.sql` | `CREATE OR REPLACE FUNCTION report_ai_incident_summary` with snippets forced to `[]` and `why_short` normalized via `LEFT(..., 500)` |
