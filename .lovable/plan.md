As CTO who built and knows the whole system, Stage 5 is still open.

We are fixing one blocker only.

Task:

Close the backend enforcement contract for the "disconnect device" action.

Business goal:

Disconnecting a child device is a sensitive owner-only action.

The backend must enforce this explicitly and deterministically, matching the UI contract.

This is a narrow implementation task.

Do not widen scope.

Do NOT touch:

- chores/co-parent UI filtering

- invite co-parent flow

- upgrade CTA gating

- alerts behavior

- unrelated parent pages

- Android child logic

Problem to fix:

Current audit shows:

- ChildControlV2 exposes "disconnect device" only to owner in the UI

- but backend enforcement is not logically closed

- current path updates `devices.child_id = null` directly

- audit indicates there is no clear UPDATE RLS policy on `devices`

- therefore the action is either broken for everyone or not properly protected in backend

Required behavior after fix:

1. Disconnect device must be backend-enforced as owner-only.

2. Co-parent must not be able to disconnect a device.

3. Unauthorized users must not be able to disconnect another family’s device.

4. The UI contract should remain owner-only.

5. Prefer a dedicated backend path over relying on raw table update from the client.

6. Do not redesign the family model.

Preferred fix shape:

- Add a dedicated RPC/function for disconnecting a device safely

- Validate that the target device belongs to a child owned by auth.uid()

- Perform the disconnect in backend

- Update parent-side call site only as needed to use this backend path

Hard scope:

Only touch code directly involved in:

- disconnect device action in ChildControlV2 (or its hook)

- backend SQL/RPC/migration needed for explicit owner-only enforcement

- types if required by the changed RPC contract

What I need returned:

1. Files Changed

- exact file list

2. Exact Root Cause

- exact previous client write path

- why backend enforcement was not logically closed before

3. Exact Fix

- exact RPC/function/migration added or changed

- exact owner-only authorization rule

- why co-parent is denied

- why unauthorized users are denied

4. Exact Code Proof

Paste the real current code for:

- the backend function/RPC that disconnects the device

- the authorization check inside it

- the updated frontend call site that invokes it

5. Behavior Proof

State the result for these exact cases:

- owner disconnects child device

- co-parent attempts disconnect

- unrelated authenticated user attempts disconnect

For each:

- result

- exact backend code path

- whether the device is disconnected or denied

6. Permission Safety

- confirm owner allowed: yes/no

- confirm co-parent allowed: yes/no

- confirm unrelated user allowed: yes/no

7. Deploy / Type Status

- migration created: yes/no

- exact migration file

- deployed: yes/no or UNPROVEN

- frontend typecheck status if provable, otherwise UNPROVEN

8. Stage 5 Impact

Return exactly one:

- BLOCKER CLOSED

- BLOCKER NOT CLOSED

Hard rejection conditions:

Your answer will be rejected if you:

- patch only the UI

- continue using raw client update without explicit backend enforcement

- allow co-parent to disconnect

- fail to show the exact authorization SQL