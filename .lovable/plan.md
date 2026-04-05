## Geofence Phase 3: Manual Places — COMPLETED

### What was done
1. **Migration**: Extended `child_places` with `alert_on_enter`, `alert_on_exit`, `schedule_mode`, `days_of_week`, `start_time`, `end_time`. Added `MANUAL` to `place_type` CHECK. Fixed unique index to only constrain HOME/SCHOOL. Added validation trigger.
2. **RPC**: `get_device_settings` now filters `geofence_places` to HOME/SCHOOL only and adds `manual_geofence_places` as a separate key.
3. **Hook**: `useChildPlaces` extended with `manualPlaces`, `upsertManualPlace`, `deactivateManualPlace`.
4. **UI**: "מקומות נוספים" subsection in `GeofenceSection` with list + add/edit/deactivate + scheduling.

### What remains
- Android detection of manual geofences (next Android phase)
- Push notification delivery for manual place enter/exit events

---

## Co-Parent Push Delivery — COMPLETED

### What was done
1. **SQL helper**: `get_alert_recipients(p_child_id uuid)` — returns owner UNION accepted co-parents with `receive_alerts = true`. Uses `SECURITY DEFINER`, `STABLE`, deduped via `UNION`.
2. **on_heartbeat_insert trigger**: Updated to loop over `get_alert_recipients()` and call `send-push-notification` for each recipient.
3. **analyze-alert edge function**: Replaced single `childData.parent_id` push with `rpc('get_alert_recipients')` → loop per recipient.
4. **generate-periodic-summary edge function**: Same pattern — resolve recipients via RPC, loop push per recipient.
5. **send-push-notification**: UNCHANGED. Still accepts one `parent_id` and sends to all their subscriptions.

### Backward compatibility
- No co-parent → `get_alert_recipients` returns only owner → identical to previous behavior
- Co-parent with `receive_alerts = false` → excluded from results
- `UNION` guarantees dedup if owner somehow appears in both queries

### What remains
- Co-parent push for new notification categories (time requests, app installs, etc.) — out of scope
- Android child-side local notifications — separate system, untouched
