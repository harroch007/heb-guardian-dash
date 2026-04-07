As CTO who built and knows the whole system, Stage 7 is still open.

We are fixing one blocker only.

Task:

Fix the `time_request_updates.approved_minutes` contract so Android receives the actual approved amount, not the originally requested amount.

Business goal:

When the parent approves a time request with a specific amount, the Android child contract must reflect the actual granted value consistently.

This is a narrow backend contract fix.

Do not widen scope.

Do NOT touch:

- device_commands security redesign

- blocked_apps / app_policies overlap

- geofence payload shape

- parent UI behavior

- Android code

- unrelated migrations/functions

Problem to fix:

Current audit shows:

- `respond_time_request(p_request_id, p_approved, p_minutes)` accepts the actual granted amount as `p_minutes`

- but `get_device_settings` currently returns `time_request_updates.approved_minutes` from `time_extension_requests.requested_minutes`

- therefore Android can receive the wrong approved amount

Required behavior after fix:

1. `time_request_updates.approved_minutes` must reflect the actual granted amount.

2. If a request was rejected, approved_minutes should remain null or absent according to the existing payload style.

3. Do not redesign the request-more-time model.

4. Do not change Android payload keys beyond fixing the value source.

Preferred fix shape:

- keep the existing `time_request_updates` payload shape

- fix only the source used for `approved_minutes`

- choose the narrowest authoritative backend source that already stores the granted value

Hard scope:

Only touch code directly involved in:

- `get_device_settings`

- if strictly required, minimal supporting persistence/query path for actual granted minutes

- any migration/function needed for this fix

What I need returned:

1. Files Changed

- exact file list

2. Exact Root Cause

- exact previous source of `approved_minutes`

- why it was wrong

3. Exact Fix

- exact function/migration changed

- exact new source of `approved_minutes`

- why it now reflects the real granted value

4. Exact Code Proof

Paste the real current SQL/code for:

- the `time_request_updates` projection inside `get_device_settings`

- any supporting join/subquery/function changed to source actual approved minutes

5. Behavior Proof

State the result for these exact cases:

- child requested 15, parent approved 15

- child requested 15, parent approved 30

- parent rejected request

For each:

- resulting `time_request_updates` payload

- exact backend code path

6. Deploy Status

- migration created: yes/no

- exact migration file

- deployed: yes/no or UNPROVEN

7. Stage 7 Impact

Return exactly one:

- BLOCKER CLOSED

- BLOCKER NOT CLOSED

Hard rejection conditions:

Your answer will be rejected if you:

- widen scope beyond approved_minutes

- redesign the time request model

- leave `approved_minutes` sourced from `requested_minutes`

- fail to show the exact updated `get_device_settings` SQL