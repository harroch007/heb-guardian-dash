

## Investigation Results: `create_alert` returning HTTP 300

### ROOT CAUSE FOUND: Two overloaded `create_alert` functions

There are **two** functions named `public.create_alert` in the database:

```text
OID 37671 (11 args): create_alert(p_message, p_risk_level, p_source, p_device_id, p_chat_type, p_message_count, p_contact_hash, p_pii_redacted_count, p_sender_display, p_author_type, p_chat_name)

OID 98975 (12 args): create_alert(p_message, p_risk_level, p_source, p_device_id, p_chat_type, p_message_count, p_contact_hash, p_pii_redacted_count, p_sender_display, p_author_type, p_chat_name, p_client_event_id)
```

The only difference is `p_client_event_id` (added for idempotency in a recent migration).

### Why HTTP 300?

PostgREST cannot disambiguate overloaded functions when both signatures match the incoming parameters. Since all shared parameters have defaults and `p_client_event_id` also has a default (`NULL`), **both functions match any call**. PostgREST responds with **HTTP 300 Multiple Choices** — it refuses to guess which overload to call.

This is a well-documented PostgREST behavior: https://postgrest.org/en/stable/references/api/functions.html#overloaded-functions

### Why it broke all devices simultaneously

The older function (OID 37671, 11 args) was the original. When the migration added the new 12-arg version with `p_client_event_id`, it did NOT drop the old one. From that moment, every `rpc('create_alert', ...)` call from the Android app gets a 300 response and **no row is inserted**.

### The fix (for implementation mode)

Drop the old 11-arg function. The 12-arg version is a superset (the extra param defaults to `NULL`):

```sql
DROP FUNCTION public.create_alert(text, integer, text, text, text, integer, text, integer, text, text, text);
```

This single statement will resolve:
- HTTP 300 errors on all `create_alert` RPC calls
- The alert stall across all devices
- No Android code changes needed

### Task 1: API Logs

The Supabase analytics logs system does not index by PostgREST RPC path, so I could not pull the specific HTTP 300 response bodies from logs. However, the function catalog query above proves the ambiguity exists. Any client calling `/rest/v1/rpc/create_alert` will get a 300 because PostgREST finds 2 matching candidates.

### Task 2: Function Signature Summary

| Property | Old (OID 37671) | New (OID 98975) |
|---|---|---|
| Schema | public | public |
| Args | 11 (all with defaults except first 4) | 12 (same + `p_client_event_id text DEFAULT NULL`) |
| Return | bigint | bigint |
| Writes to | `public.alerts` | `public.alerts` |
| ON CONFLICT | No | Yes (`device_id, client_event_id`) |

Both are `SECURITY DEFINER`, both do the same core logic. The old one is simply obsolete.

### Parameter names (both functions use snake_case with `p_` prefix)
`p_message`, `p_risk_level`, `p_source`, `p_device_id`, `p_chat_type`, `p_message_count`, `p_contact_hash`, `p_pii_redacted_count`, `p_sender_display`, `p_author_type`, `p_chat_name` (+ `p_client_event_id` in new version only)

No camelCase mismatch. The Android app likely sends snake_case params which match both functions — causing the 300.

