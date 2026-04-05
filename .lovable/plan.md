Narrow Correction: Wire Geofence Push to alerts Table

Problem

The current trigger (`trg_geofence_event_push` on `device_events`) is connected to a table that Android never writes to for geofence alerts. The approved Android geofence implementation reports through the existing alert path — the `alerts` table — the same table used by permission alerts, AI alerts, and all other alert types.

Current Evidence

- `device_events` table: 0 rows, no geofence data, never used by Android for the current geofence flow
- `alerts` table: the universal landing table for alert creation
- Android geofence implementation already uses the existing alert-reporting path, not a new `device_events` path
- Every INSERT into `alerts` triggers `trigger_analyze_alert()` → `analyze-alert` edge function
- `analyze-alert` skips rows where `is_processed = true` (line 625)

Implementation

One migration file that does two things:

1. Drop the wrong trigger and function on `device_events`:

- `DROP TRIGGER trg_geofence_event_push ON device_events`
- `DROP FUNCTION on_geofence_event_insert()`

2. Create a new AFTER INSERT trigger on `alerts` that fires only for real geofence alerts already produced by the current Android flow:

Trigger: `trg_geofence_alert_push`  
Table: `alerts`  
Timing: `AFTER INSERT`  
Function: `on_geofence_alert_insert()`

Trigger Function Logic

`on_geofence_alert_insert()`:

- First verify the real current geofence row shape already produced in `alerts` by the Android implementation, and use that exact row signature as the trigger guard
- Do **not** assume a hypothetical insert contract like `category = 'geofence'` unless that is already what Android writes today
- Use the narrowest real condition that matches existing geofence alert rows in `alerts` and excludes all other alert categories
- `IF NEW.child_id IS NULL THEN RETURN NEW`
- Get child name  
`SELECT name FROM children WHERE id = NEW.child_id`
- Build push content  
title: `'התראת מיקום'`  
body: built from the real existing human-readable geofence message already written by Android into the alert row (`NEW.parent_message` if present, otherwise the best existing geofence text field already populated today),  
fallback: `child_name || ' - זוהתה חריגה מאזור מוגדר'`  
or generic: `'זוהתה חריגה מאזור מוגדר'`
- Send push to all recipients  
`FOR recipient IN SELECT get_alert_recipients(NEW.child_id)`  
`net.http_post` → `send-push-notification`  
`parent_id, title, body, url='/alerts', alert_id=NEW.id, child_name`

Why This Is Safe

- No duplicate push from AI pipeline: use the real current geofence alert row signature already produced by Android, and ensure the trigger fires only for that exact signature
- If current geofence alerts are already inserted with `is_processed = true`, `analyze-alert` will continue to skip them at line 625
- INSERT-only trigger: no re-fire on updates
- Narrow row-signature filter: only real geofence alerts trigger push — all other alert types continue through their existing paths unchanged
- One source of truth: push fires from the `alerts` INSERT trigger only, not from `analyze-alert`

Android Contract (No Android Changes Needed)

Android already uses the existing alert path for geofence reporting.  
This fix must attach parent push to the exact alert row shape Android already writes today.

Do **not** require Android to switch tables, add a new RPC, or change reporting path.  
Do **not** assume a new direct INSERT contract if the current Android code already uses the existing alert creation helper/path.

Backward Compatibility

- All existing push categories unchanged (AI, permission, periodic, time request, app alert)
- `analyze-alert` pipeline unaffected
- Existing `on_alert_created` trigger (`trigger_analyze_alert`) continues to fire for all inserts — geofence rows continue through the current pipeline exactly as today, with the new push attached only to the real geofence rows
- No schema changes, no new tables, no new columns
- `get_alert_recipients` reused — owner + co-parents with `receive_alerts = true`

Files Changed


| File              | Change                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| New migration SQL | Drop `device_events` trigger+function, create `alerts` trigger+function for geofence push using the real existing geofence alert row signature |


Push Payload

- Title: `התראת מיקום`
- Body: uses the real existing human-readable geofence message already stored in the alert row by Android (prefer `NEW.parent_message` if present; otherwise the real existing geofence text field already populated today), fallback to `child_name || ' - זוהתה חריגה מאזור מוגדר'`, else `זוהתה חריגה מאזור מוגדר`
- URL: `/alerts`
- `alert_id`: `NEW.id`
- `child_name`: from `children` table