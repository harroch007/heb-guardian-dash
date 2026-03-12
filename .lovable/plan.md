

## Analysis: End-to-End Sync Problem Between Parent and Child Device

### What the data tells us

| Signal | Evidence | Conclusion |
|--------|----------|------------|
| `get_device_settings` returns `blocked_apps: ["com.google.android.youtube"]` | Server data is correct | **Not a server-side data problem** |
| `REFRESH_SETTINGS` command from 14:30 today → status `COMPLETED` | Device received and acknowledged the command | **Device got the command** |
| `blocked_app_attempts` for YouTube = **0 rows** | Device never tried to enforce the block | **Android enforcement bug** |
| Last heartbeat: March 6 (6 days ago) | Device stopped sending heartbeats | **Heartbeat mechanism broken** |
| Last `app_usage` update: 14:19 today (12 min before the REFRESH command) | Usage data is flowing, but sporadically | **Usage reporting works but is delayed** |
| Realtime enabled on: `devices`, `device_commands` only | `app_usage` has no realtime | **Parent dashboard won't auto-refresh usage** |

### The Android agent's diagnosis is mostly correct. Here's my refined analysis:

**Problem 1: YouTube not blocked (Android-side)**
The server chain is working perfectly: policy saved → `REFRESH_SETTINGS` command created → device marked it `COMPLETED` → `get_device_settings` returns YouTube in `blocked_apps`. But the device does **zero enforcement** (no `blocked_app_attempts` logged). This is 100% an Android APK bug — the AccessibilityService receives the settings but doesn't act on them.

**Problem 2: Parent dashboard doesn't auto-refresh (Web-side)**
`ChildDashboard.tsx` fetches `parent_home_snapshot` once on mount (line 174). There's a realtime subscription on `devices` (line 204) for battery/location, but **no subscription or polling on `app_usage`** data. The parent sees stale data until manual page refresh.

**Problem 3: Heartbeats stopped 6 days ago (Android-side)**
Last heartbeat: March 6. The Android agent confirmed `sendDeviceHealthStatus` is empty. Without heartbeats, the server can't accurately track device connectivity.

**Problem 4: Delayed command pickup (Android-side)**
The Android agent found that `SyncWorker` only runs via WorkManager (which Android throttles for battery). There's no Realtime listener in the AccessibilityService, so commands aren't picked up instantly — they wait for the next WorkManager cycle.

---

### Recommended fixes by side

#### Server/Web side (what I can do):

1. **Add polling to parent dashboard** — `ChildDashboard.tsx` should re-fetch `parent_home_snapshot` every 60 seconds so the parent sees updated usage without manual refresh.

2. **Filter stale commands from SyncNotice** — Add a `created_at` filter (last 5 minutes) to the `device_commands` query in `useChildControls.ts` so old completed/acknowledged commands don't clutter the UI.

3. **Add `app_usage` to Realtime** — Enable realtime on the `app_usage` table so the parent dashboard could subscribe to live usage changes (alternative to polling, but polling is simpler and more reliable).

#### Android side (what the Android agent needs to do):

1. **Fix enforcement in AccessibilityService** — The service receives the blocked list from `get_device_settings` but doesn't enforce it. It needs to compare the foreground app against the blocked list and overlay/block when matched.

2. **Add Realtime subscription for `device_commands`** — Instead of relying solely on WorkManager, the AccessibilityService (or ForegroundService) should open a Supabase Realtime channel on `device_commands` filtered by `device_id`. When a new `REFRESH_SETTINGS` command arrives, immediately trigger a settings refresh.

3. **Implement heartbeat reporting** — Fill in the empty `sendDeviceHealthStatus` function to actually call `report_device_heartbeat` RPC on a regular interval (every 15-30 minutes).

4. **Add periodic usage reporting** — Ensure `upsert_app_usage` is called on a timer (every 5-10 minutes), not just on app-switch events, so data flows even when the child stays in one app.

### Implementation plan (server/web side only):

**File 1: `src/pages/ChildDashboard.tsx`**
- Add a `useEffect` with `setInterval(60000)` to re-fetch `parent_home_snapshot` data
- Also re-fetch device info on the same interval

**File 2: `src/hooks/useChildControls.ts`**
- Add `.gte("created_at", fiveMinutesAgo)` to the `device_commands` query (line 201-208)
- This prevents stale commands from showing in the SyncNotice

These are the only web-side changes. The core problems (enforcement, realtime listener, heartbeat) must be fixed in the Android APK.

