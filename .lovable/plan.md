## Final Alignment Pass — Engine & Privacy Hardening (COMPLETED)

### What Changed

1. **Privacy Alignment (previous migration)**: `report_ai_incident_summary` RPC hardened — `evidence_snippets` forced to `'[]'::jsonb`, `why_short` capped to 500 chars.

2. **Duplicate RPC removed (this migration)**: Dropped the old unhardened overload of `report_ai_incident_summary` that could bypass privacy hardening. Only the hardened version remains.

### Engine Naming (Frozen)

| Type   | Accepted Names                              |
| ------ | ------------------------------------------- |
| Voice  | `mlkit_speech`, `local_bundled_asr`         |
| SLM    | `litert_local`, `mlkit_genai`, `heuristic`  |
| Status | `healthy`, `degraded`, `unavailable`, `unknown` |

### Privacy Result

| Field                  | Behavior                                    |
| ---------------------- | ------------------------------------------- |
| `why_short`            | Capped to 500 chars inside RPC              |
| `evidence_message_ids` | IDs only (unchanged)                        |
| `evidence_snippets`    | Always forced to `[]` by RPC                |

### What Stays

- No UI changes
- No Android changes
- No new tables or features
- All other RPCs verified clean (single versions, correct defaults)
