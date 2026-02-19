
# Queue Worker Mode for analyze-alert Edge Function

## Summary
Add a "queue mode" to the existing `analyze-alert` Edge Function so it can claim and process pending jobs from `alert_events_queue`, without removing any existing HTTP/HMAC handling.

## What Changes

### 1. Update `supabase/functions/analyze-alert/index.ts`

Add queue mode detection at the top of the request handler, before the existing legacy/HMAC routing logic:

**New flow (inserted before existing routing):**

1. Parse the request body. If it's empty (`""` or `"{}"`) OR contains `{ "mode": "queue" }`, enter queue mode.
2. In queue mode:
   - Create a Supabase service-role client (using `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).
   - Call `supabase.rpc('claim_alert_events', { _event_type: 'ai_analyze', _limit: 1, _lease_seconds: 60 })`.
   - If no rows returned, respond `200 { "status": "no_jobs" }`.
   - If a row is returned, extract `queueId = row.id` and `alertId = row.alert_id`.
   - Fetch the alert from `alerts` table by `alertId`.
   - Run the **existing** analysis pipeline (OpenAI call, training dataset copy, title building, DB update, push notification).
   - On success: update `alert_events_queue` set `status = 'succeeded'`, `last_error = null`, `updated_at = now()` where `id = queueId`.
   - On error (catch): update `alert_events_queue` set `status = 'failed'`, `last_error = error message (truncated to 400 chars)`, `updated_at = now()` where `id = queueId`. Also update `alerts` set `processing_status = 'failed'`, `last_error = error message` where `id = alertId`.
3. Return a response with the result.

**Existing modes preserved exactly as-is:**
- `body.type === 'INSERT' && body.record` -- legacy webhook (unchanged)
- `body.alert_id` with HMAC header -- direct call (unchanged)

### 2. Refactor: Extract shared analysis logic

To avoid duplicating the ~250 lines of analysis code, the core processing logic (from "fetch alert" through "push notification") will be extracted into an `async function processAlert(supabase, alertId, openAIApiKey, supabaseUrl, supabaseServiceKey)` helper within the same file. Both the legacy/HMAC path and the new queue path will call this shared function.

### 3. Queue status column mapping (DB reality)

The actual `alert_events_queue` columns are:
- `id` (uuid) -- job ID
- `alert_id` (bigint) -- direct column, NOT inside a payload jsonb
- `status` (text) -- 'pending' / 'processing' / 'succeeded' / 'failed'
- `attempt` (integer) -- incremented by `claim_alert_events` RPC
- `max_attempts` (integer, default 5)
- `last_error` (text, nullable)
- `visible_at`, `created_at`, `updated_at` (timestamps)

The `claim_alert_events` RPC already handles locking and incrementing `attempt`. We only need to set final `status` and `last_error` after processing.

## Technical Details

### Queue mode entry point (pseudocode)

```text
const rawBody = await req.text();
const body = rawBody ? JSON.parse(rawBody) : {};

// --- QUEUE MODE ---
if (!rawBody || Object.keys(body).length === 0 || body.mode === 'queue') {
  const supabase = createClient(url, serviceKey);
  const { data: jobs } = await supabase.rpc('claim_alert_events', {
    _event_type: 'ai_analyze', _limit: 1, _lease_seconds: 60
  });
  if (!jobs || jobs.length === 0) return respond({ status: 'no_jobs' });

  const job = jobs[0];
  try {
    const result = await processAlert(supabase, job.alert_id, ...);
    await supabase.from('alert_events_queue')
      .update({ status: 'succeeded', last_error: null, updated_at: new Date().toISOString() })
      .eq('id', job.id);
    return respond({ status: 'succeeded', alert_id: job.alert_id, ...result });
  } catch (err) {
    await supabase.from('alert_events_queue')
      .update({ status: 'failed', last_error: String(err).slice(0,400), updated_at: new Date().toISOString() })
      .eq('id', job.id);
    await supabase.from('alerts')
      .update({ processing_status: 'failed', last_error: String(err).slice(0,400) })
      .eq('id', job.alert_id);
    return respond({ status: 'failed', error: String(err) }, 500);
  }
}

// --- LEGACY MODES (unchanged) ---
// ... existing code ...
```

### processAlert helper

Extracts the shared logic from line ~213 to ~495 of the current file into a reusable function:
- Input: `supabase client`, `alertId`, `openAIApiKey`, `supabaseUrl`, `supabaseServiceKey`
- Returns: `{ ai_summary, ai_verdict, ai_risk_score, ... }` on success
- Throws on error

Both the queue path and the existing HMAC/webhook path will call this function.

### No database migrations needed

All required tables (`alert_events_queue`) and functions (`claim_alert_events`) already exist in the live database. The `alerts` table already has `processing_status` and `last_error` columns.

### RLS consideration

The `alert_events_queue` table has restrictive RLS policies (all `false` for public roles). The edge function uses the **service role key**, which bypasses RLS -- so no policy changes needed.

## Smoke Test Plan

After deployment, you can verify the queue mode works:

**Step 1 -- Check for pending queue items:**
```sql
SELECT id, alert_id, status, attempt, last_error, created_at
FROM alert_events_queue
WHERE event_type = 'ai_analyze' AND status = 'pending'
ORDER BY created_at DESC
LIMIT 5;
```

**Step 2 -- Invoke in queue mode:**
Send an HTTP POST to the edge function with body `{"mode": "queue"}`:
```
POST https://fsedenvbdpctzoznppwo.supabase.co/functions/v1/analyze-alert
Content-Type: application/json

{"mode": "queue"}
```

Or use `supabase.functions.invoke('analyze-alert', { body: { mode: 'queue' } })` from the app.

**Step 3 -- Verify results:**
```sql
-- Queue row should now be 'succeeded' or 'failed'
SELECT id, alert_id, status, attempt, last_error, updated_at
FROM alert_events_queue
WHERE event_type = 'ai_analyze'
ORDER BY updated_at DESC
LIMIT 5;

-- Alert should have ai_* fields populated
SELECT id, ai_verdict, ai_summary, ai_risk_score, analyzed_at, processing_status, is_processed
FROM alerts
WHERE id = <the_alert_id_from_above>
```

**Step 4 -- Create a fresh test alert (optional):**
```sql
SELECT public.create_alert(
  'Test message for queue worker',  -- p_message
  50,                                -- p_risk_level
  'test-device',                     -- p_source (device_id)
  'test-device',                     -- p_device_id
  'PRIVATE',                         -- p_chat_type
  1,                                 -- p_message_count
  NULL, 0, NULL, 'UNKNOWN', 'Test Contact'
);
```
This will fire the `trg_enqueue_ai_analyze` trigger, creating a pending queue row. Then invoke the function again with `{"mode": "queue"}`.

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/analyze-alert/index.ts` | Add queue mode + extract `processAlert` helper |

No other files change. No new edge functions. No migrations.
