## Push Notification for Time Extension Requests

### Current Flow (No Changes)

- Android calls `request_extra_time(p_child_id, p_reason)` RPC
- RPC inserts into `time_extension_requests` with `status = 'pending'`
- Parent sees requests via `TimeRequestsCard` polling — **no push today**

### Implementation

**One migration file** — add a trigger on `time_extension_requests` INSERT that sends push via the same `net.http_post` → `send-push-notification` pattern already used in `on_heartbeat_insert`.

#### Trigger: `on_time_request_insert()`

```
1. Only fires on INSERT (not UPDATE) → no duplicate push on approve/reject
2. Only fires when NEW.status = 'pending' (safety check)
3. Resolves child name: SELECT name FROM children WHERE id = NEW.child_id
4. Resolves recipients: FOR v_recipient_id IN SELECT get_alert_recipients(NEW.child_id)
5. Calls net.http_post to send-push-notification for each recipient
6. Payload:
   - title: "בקשת זמן חדשה"
   - body: "[child_name] ביקש/ה עוד זמן למסך" (with safe fallback if child name is null/empty)
   - url: "/child-v2/" || NEW.child_id
```

Exact same pattern as the heartbeat trigger (lines 110-132 of the co-parent migration).

### Files Changed


| File              | Change                                                                             |
| ----------------- | ---------------------------------------------------------------------------------- |
| New migration SQL | `on_time_request_insert()` trigger function + trigger on `time_extension_requests` |


No edge function changes. No UI changes. No schema changes.

### Backward Compatibility

-   
No co-parent → `get_alert_recipients` returns owner only → same as before  

-   
Co-parent with `receive_alerts = false` → excluded  

-   
Approve/reject updates → trigger only fires on INSERT, not UPDATE  

-   
Existing polling/realtime UI → untouched  
