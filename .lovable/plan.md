## Geofence Phase 3: Manual Places — COMPLETED

### What was done
1. **Migration**: Extended `child_places` with `alert_on_enter`, `alert_on_exit`, `schedule_mode`, `days_of_week`, `start_time`, `end_time`. Added `MANUAL` to `place_type` CHECK. Fixed unique index to only constrain HOME/SCHOOL. Added validation trigger.
2. **RPC**: `get_device_settings` now filters `geofence_places` to HOME/SCHOOL only and adds `manual_geofence_places` as a separate key.
3. **Hook**: `useChildPlaces` extended with `manualPlaces`, `upsertManualPlace`, `deactivateManualPlace`.
4. **UI**: "מקומות נוספים" subsection in `GeofenceSection` with list + add/edit/deactivate + scheduling.

### What remains
- Android detection of manual geofences (next Android phase)
- Push notification delivery for manual place enter/exit events
