## Push Notification for New App Detection

### Current Flow (No Changes)

- Android calls `create_app_alert(p_device_id, p_package_name, p_app_name)` RPC
- RPC resolves `child_id` from `devices`, inserts one row into `app_alerts`
- Each row is a single new-app event — no updates, no re-syncs to the same row
- Parent sees events via `NewAppsCard` polling `app_alerts` table — no push today

### Implementation

**One migration file** — add a trigger on `app_alerts` INSERT that sends push via the same `net.http_post` → `send-push-notification` pattern already used in `on_time_request_insert` and `on_heartbeat_insert`.

#### Trigger: `on_app_alert_insert()`

```
1. Fires AFTER INSERT on app_alerts — one row = one new app = one push
2. Guard: if NEW.child_id IS NULL, return immediately with no push
3. Resolves child name: SELECT name FROM children WHERE id = NEW.child_id
4. Builds body:
   - If child_name AND app_name available: "[child_name] התקין/ה את [app_name]"
   - If only app_name: "אפליקציה חדשה זוהתה: [app_name]"
   - Fallback: "זוהתה אפליקציה חדשה במכשיר"
5. Resolves recipients: FOR v_recipient_id IN SELECT get_alert_recipients(NEW.child_id)
6. Calls net.http_post to send-push-notification for each recipient
7. Payload:
   - title: "אפליקציה חדשה זוהתה"
   - body: (as above)
   - url: "/child-v2/" || NEW.child_id
```

### Files Changed


| File              | Change                                                             |
| ----------------- | ------------------------------------------------------------------ |
| New migration SQL | `on_app_alert_insert()` trigger function + trigger on `app_alerts` |


No edge function changes. No UI changes. No schema changes.

### Backward Compatibility

-   
No co-parent → `get_alert_recipients` returns owner only  

-   
Co-parent with `receive_alerts = false` → excluded  

-   
Trigger is INSERT-only → no duplicate push on later row changes even if update paths are added in future  

-   
Existing polling UI (`NewAppsCard`) → untouched  

- `create_app_alert` RPC → untouched  

-   
All other push categories → untouched  


### Technical Detail

Guard for `NEW.child_id IS NULL` — if device is not paired to a child, skip push silently (same as heartbeat trigger pattern). If `app_name` is null/empty, use the fallback copy path above.