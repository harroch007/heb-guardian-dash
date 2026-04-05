As CTO who built and knows the whole system, I am giving you one narrow task only.

Task:

Resolve the geofence parent-push contract at the backend, definitively and with proof.

This is Supabase / backend only.

Do not touch Android.

Do not touch Lovable UI.

Do not redesign alerts.

Do not redesign push architecture.

Do not widen scope beyond the exact `create_alert` contract needed for geofence alerts.

Goal:

We already have:

- Android geofence reporting routed through `create_alert`

- a deployed geofence parent-push trigger on `alerts`

- existing parent push delivery through `send-push-notification`

- existing recipient resolution through `get_alert_recipients(child_id)`

The only thing that matters now is:

when Android calls `create_alert` for a geofence alert, does the resulting row in `alerts` actually match the deployed geofence push trigger contract?

This task must end in one of only two valid outcomes:

1. `create_alert` already supports the required geofence fields exactly → prove it with exact evidence, no code changes

2. `create_alert` does NOT support them exactly → make the smallest safe backend fix so it does, then prove it

No other outcome is acceptable.

Critical scope rule:

Do not redesign the system.

Do not add a new alert path.

Do not tell me what Android “should” send in theory.

Do not rely on assumptions.

Do not return architecture ideas.

Return hard proof and, only if needed, the smallest backend fix.

Required geofence alert row contract:

The final inserted row in `alerts` must be able to contain:

- `category = 'geofence'`

- `sender = 'SYSTEM'`

- `platform = 'SYSTEM'`

- `is_processed = true`

- `ai_verdict = 'notify'`

- `parent_message` = populated parent-facing Hebrew message

- `child_id` resolved correctly

- `device_id` resolved/persisted correctly if the current path supports it

And this must be achieved through the existing `create_alert` RPC path.

What you must do:

1. Inspect the real current `create_alert` function

I need exact proof of the current live backend contract.

Show exactly:

- the current function signature of `create_alert`

- whether it already accepts each of these parameters:

  - `p_category`

  - `p_sender`

  - `p_platform`

  - `p_is_processed`

  - `p_ai_verdict`

  - `p_parent_message`

  - `p_device_id`

- whether `child_id` is resolved from `p_device_id` internally, and exactly how

2. Inspect the real INSERT logic inside `create_alert`

I need exact proof of what row is written into `alerts`.

Show exactly:

- which incoming params map to which `alerts` columns

- whether any defaults override incoming values

- whether any fields are ignored

- whether `create_alert` currently forces its own values for:

  - `category`

  - `sender`

  - `platform`

  - `is_processed`

  - `ai_verdict`

  - `parent_message`

3. Decide based on proof, not assumption

If the current function already supports the geofence contract exactly:

- do not change code

- return proof only

If the current function does NOT support the geofence contract exactly:

- make the smallest safe backend fix only

- extend `create_alert` narrowly so the Android geofence call can produce the required row shape

- do not change unrelated alert categories

- do not redesign any other part of the system

4. Preserve backward compatibility

Any fix must not break:

- existing AI/chat alert creation

- existing parent push categories

- existing non-geofence `create_alert` callers

- existing alert processing logic

5. Exact proof required at the end

Return exact execution proof only.

I need:

1. Exact files / migrations / functions changed

2. Exact `create_alert` signature before

3. Exact `create_alert` signature after (or say unchanged if no change was needed)

4. Exact INSERT mapping into `alerts`

5. Exact proof whether geofence rows created through `create_alert` now match all of:

   - `category = 'geofence'`

   - `sender = 'SYSTEM'`

   - `platform = 'SYSTEM'`

   - `is_processed = true`

   - `ai_verdict = 'notify'`

   - `parent_message` populated

6. Exact proof of how `child_id` is resolved

7. Exact backward compatibility proof for existing alert categories

8. Migration / deploy status

9. Explicit report:

   - did it pass on the first try

   - if not, what failed first

   - exactly what you fixed

Return format:

Do not summarize.

Do not give recommendations.

Do not give future steps.

Return exact technical proof only.