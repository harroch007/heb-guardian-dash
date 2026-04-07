As CTO who built and knows the whole system, Stage 3B is still open.

We are fixing one blocker only.

Task:

Add deterministic child sync-back for geofence configuration changes.

Business goal:

Whenever geofence configuration changes, the child device must receive REFRESH_SETTINGS deterministically, not wait for the next natural poll.

This is a narrow implementation task.

Do not widen scope.

Important:

Do NOT change the geofence payload shape.

Do NOT redesign HOME/SCHOOL vs manual contract.

Do NOT touch parent UI behavior unless absolutely required.

Do NOT change permissions/RLS unless strictly required for this specific fix.

Do NOT touch Android code.

Problem to fix:

Current audit shows:

- parent geofence write paths update child_places and child_geofence_settings directly

- but no REFRESH_SETTINGS command is inserted after those writes

- therefore child sync-back is not deterministic

Required behavior after fix:

1. Any successful geofence config change must enqueue REFRESH_SETTINGS for that child’s device(s).

2. This must cover:

   - HOME create/update/delete

   - SCHOOL create/update/delete

   - MANUAL create/update/update-is_active

   - child_geofence_settings insert/update

3. Existing payload contract must remain unchanged.

4. Existing owner/co-parent permissions must remain unchanged.

5. Do not redesign the geofence model.

Preferred fix shape:

Implement this in backend so all current write paths are covered automatically.

Prefer trigger/function-based sync-back on the geofence tables rather than duplicating command insertion in multiple UI hooks.

Hard scope:

Only touch code directly involved in:

- child_places change handling

- child_geofence_settings change handling

- device_commands insertion for REFRESH_SETTINGS

- minimal migration SQL / backend objects required

What I need returned:

1. Files Changed

- exact file list

2. Exact Root Cause

- exact previous write paths

- why child sync-back was non-deterministic before

3. Exact Fix

- exact trigger/function/migration added or changed

- which table events now enqueue REFRESH_SETTINGS

- why this covers all current parent write paths

4. Exact Code Proof

Paste the real current SQL for:

- the trigger function that inserts REFRESH_SETTINGS

- trigger(s) on child_places

- trigger(s) on child_geofence_settings

5. Behavior Proof

State the result for these exact cases:

- owner updates HOME radius

- co-parent updates SCHOOL settings

- owner adds MANUAL place

- co-parent deactivates MANUAL place

- owner deletes HOME

For each:

- whether REFRESH_SETTINGS is inserted

- how child_id is resolved

- exact code path

6. Permission Safety

- confirm owner still works

- confirm co-parent still works

- confirm unauthorized users still cannot modify another child’s config

- exact RLS/auth references if touched

7. Deploy / Migration Status

- migration created: yes/no

- exact migration file

- deployed: yes/no or UNPROVEN

8. Stage 3B Impact

Return exactly one:

- BLOCKER CLOSED

- BLOCKER NOT CLOSED

Hard rejection conditions:

Your answer will be rejected if you:

- change payload shape

- redesign HOME/SCHOOL vs manual contract

- patch only one UI hook instead of closing the backend write surface

- fail to cover both child_places and child_geofence_settings

- fail to show the exact trigger/function SQL