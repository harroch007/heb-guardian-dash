As CTO who built and knows the whole system, Stage 2B is still open.

We are fixing one blocker only.

Task:

Fix the respond_time_request backend contract so that both owner and co-parent can approve or reject a time request.

Business goal:

A co-parent who is authorized in the family model must be able to respond to a pending time request, not just view it.

This is a narrow implementation task.

Do not widen scope.

Do NOT touch:

- request creation flow

- request TTL / cleanup

- realtime subscriptions

- hardcoded 15-minute UI behavior

- notification matrix beyond what is already required by the existing RPC

- Android child logic

- unrelated refactors

Problem to fix:

Current audit shows:

- request_extra_time creates the row with parent_id = owner

- respond_time_request filters with WHERE id = p_request_id AND parent_id = auth.uid()

- therefore co-parent callers get REQUEST_NOT_FOUND even though co-parent access is intended and RLS was updated

Required behavior after fix:

1. Owner can approve/reject their child’s pending request.

2. Co-parent can also approve/reject the same pending request if they are authorized for that child/family.

3. Double response must still be prevented.

4. Existing status transitions must remain:

   - pending -> approved

   - pending -> rejected

5. Approve path must still insert bonus_time_grants and REFRESH_SETTINGS exactly as before.

6. Reject path behavior must remain unchanged for this task.

7. Do not redesign the family authorization model.

Hard scope:

Only touch code directly involved in:

- respond_time_request RPC/function

- the minimal SQL authorization check needed to validate owner/co-parent access

- types if required by the changed function signature/body

- parent-side code only if strictly required by the same existing RPC contract

Do not change the request_extra_time RPC for this task.

What I need returned:

1. Files Changed

- exact file list

2. Exact Root Cause

- exact previous auth/filter logic

- why co-parent failed before

3. Exact Fix

- exact function/migration changed

- exact new authorization rule for owner + co-parent

- why owner still works

- why co-parent now works

4. Exact Code Proof

Paste the real current code for:

- the authorization lookup section inside respond_time_request

- the status transition guard

- the approve path insertions (bonus_time_grants and REFRESH_SETTINGS)

5. Behavior Proof

State the result for these exact cases:

- owner approves pending request

- co-parent approves pending request

- owner rejects pending request

- co-parent rejects pending request

- second parent tries to respond after first parent already responded

For each:

- result

- status transition

- exact code path

6. Deploy / Migration Status

- migration created: yes/no

- if yes: exact migration file

- deployed: yes/no or UNPROVEN

7. Stage 2B Impact

Return exactly one:

- BLOCKER CLOSED

- BLOCKER NOT CLOSED

Hard rejection conditions:

Your answer will be rejected if you:

- change unrelated flows

- redesign the family model

- break owner behavior

- allow unauthorized non-family parents

- remove the existing double-response protection

- fail to show the exact updated SQL