## Privacy Alignment — Incident Summaries Hardening (COMPLETED)

### What Changed

Single migration applied to `report_ai_incident_summary` RPC:

1. **`evidence_snippets` forced to `'[]'::jsonb`** in all 3 INSERT paths and the UPDATE path. The `p_evidence_snippets` parameter remains in the signature for Android backward compatibility but its value is ignored.
2. **`why_short` capped to 500 chars** via `LEFT(COALESCE(p_why_short, ''), 500)` in both INSERT and UPDATE paths.
3. **Privacy contract documented** as a SQL comment inside the function.

### Privacy Result

| Field                  | Before                       | After                               |
| ---------------------- | ---------------------------- | ----------------------------------- |
| `why_short`            | Uncapped text                | Trimmed to max 500 chars inside RPC |
| `evidence_message_ids` | IDs only (correct)           | Unchanged                           |
| `evidence_snippets`    | Stores whatever caller sends | Always forced to `[]` by RPC        |

### What Stays

- `evidence_snippets` column stays in table (backward compat)
- `p_evidence_snippets` parameter stays in RPC signature (Android compat)
- No UI changes, no Android changes, no other RPCs touched
