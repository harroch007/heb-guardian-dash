

## Analysis: "Last synced 33 min ago" is an Android-side problem

### What's actually happening

The refresh/sync button on the parent Dashboard works correctly:
1. `handleRefresh()` (Dashboard.tsx:483) calls `fetchSnapshot(false, true)` which queries `parent_home_snapshot`
2. The toast "הנתונים עודכנו" confirms the web app successfully fetched fresh data from Supabase
3. The 60-second polling in ChildDashboard is also working

**But**: the `last_seen` timestamp displayed as "סונכרן לפני 33 דק" comes from `devices.last_seen`, which is only updated when the **Android device** calls one of these RPCs:
- `update_device_status`
- `upsert_app_usage` (stamps `first_seen_at`)
- `report_device_heartbeat` (trigger updates `last_seen`)

If the child's phone hasn't called any of these in 33 minutes, the web dashboard will keep showing "33 דק" no matter how many times you press refresh.

### Two distinct "sync" concepts

| Concept | What it means | Status |
|---------|--------------|--------|
| Web dashboard refresh | Parent app re-reads DB | Working (60s poll + manual button) |
| Device sync | Child phone reports to server | Broken -- Android not reporting |

### What can be improved on the web side

There is one UX improvement we can make: **differentiate between "dashboard refresh" and "device sync"** so the parent understands that the data is stale because the device isn't reporting, not because the dashboard isn't fetching.

#### Option A: Add a "Request Sync" button (recommended)
When the parent taps it, send a `REFRESH_SETTINGS` or `REPORT_HEARTBEAT` command to `device_commands`. This nudges the Android device to wake up and report. The button would show:
- "מבקש עדכון מהמכשיר..." while PENDING
- "המכשיר עדכן בהצלחה" on COMPLETED
- "המכשיר לא מגיב" on TIMED_OUT

This already exists in ChildDashboard via `handleLocateNow` pattern but not for general sync.

#### Option B: Show clearer status text
Change "סונכרן לפני 33 דק" to something like "המכשיר דיווח לאחרונה לפני 33 דק" to make it clear this is the device's last report, not the dashboard's last refresh.

### Root cause remains Android-side
The Android agent needs to:
1. Implement periodic heartbeat reporting (every 15 min)
2. Add Realtime listener on `device_commands` to respond immediately
3. Ensure `upsert_app_usage` runs on a timer, not just on app-switch events

### Proposed implementation (web-side UX only)
1. **Dashboard.tsx**: Add a "Request Device Sync" action that inserts a `REPORT_HEARTBEAT` command into `device_commands` and polls for completion (reusing the locate-now pattern from ChildDashboard)
2. **Status text**: Update the "סונכרן" label to clarify it refers to the device's last report

No database changes needed -- the `device_commands` table and `REPORT_HEARTBEAT` command type already exist.

