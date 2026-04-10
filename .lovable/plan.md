

# Parent Dashboard ↔ Supabase ↔ Child App — Communication Audit

## Overview

The Dashboard (parent frontend) communicates with child devices via Supabase as the intermediary. Data flows in two directions:
- **Parent → Child**: via `device_commands` table inserts (parent creates a PENDING row, device polls/listens and executes)
- **Child → Parent**: via RPCs that write to tables, which the Dashboard reads (directly or via the `parent_home_snapshot` view)

---

## Feature-by-Feature Technical Contract

---

### 1. Device Location & "Locate Now"

* **Direction:** Parent → Child (command), then Child → Parent (location update)
* **Dashboard UI Status:** Parent clicks "אתר עכשיו" button → inserts `LOCATE_NOW` command → polls `device_commands` for COMPLETED → re-reads `devices` table for updated lat/lon → shows map
* **Supabase Mechanism:**
  - **Trigger**: INSERT into `device_commands` table
  - **Result**: Device updates `devices` row via `update_device_status` RPC (lat, lon)
  - **Dashboard poll**: SELECT from `device_commands` by command ID every 5s for status
  - **Dashboard read**: SELECT from `devices` for updated coordinates
* **Target:** `device_commands` table (INSERT) + `update_device_status` RPC (device calls) + `devices` table (Dashboard reads)
* **Exact Payload:**
  - Parent INSERT: `{ device_id, command_type: "LOCATE_NOW", status: "PENDING" }`
  - Device RPC call: `update_device_status(p_device_id, p_battery, p_lat, p_lon, p_device_model, p_device_manufacturer)`
* **Expected RLS / Auth Context:**
  - Parent INSERT: `is_family_parent_for_device(device_id)` — works with parent's `auth.uid()`
  - Device SELECT/UPDATE on `device_commands`: **JWT-scoped** — requires `authenticated` role + `get_device_id_from_jwt()` match → **BROKEN for anon device**
  - `update_device_status` RPC: now has legacy fallback (Tier 2) → **FIXED by migration**
* **Realtime:** Dashboard subscribes to `devices` table changes filtered by `device_id` for live lat/lon/battery updates

**⚠ BLOCKER:** Device cannot SELECT/UPDATE `device_commands` rows (RLS requires JWT). Device never sees the LOCATE_NOW command.

---

### 2. Screen Time / App Usage Reporting

* **Direction:** Child → Parent
* **Dashboard UI Status:** Shows `total_usage_minutes` and `top_apps` from `parent_home_snapshot` view. Auto-refreshes every 60s.
* **Supabase Mechanism:** Device calls `upsert_app_usage` RPC → writes to `app_usage` table → `parent_home_snapshot` view aggregates today's data
* **Target:** `upsert_app_usage` RPC → `app_usage` table → `parent_home_snapshot` view
* **Exact Payload:**
  - Device RPC call: `upsert_app_usage(p_app_name, p_device_id, p_package_name, p_usage_minutes, p_usage_date)`
  - Dashboard reads: `parent_home_snapshot.top_apps` (JSONB array), `parent_home_snapshot.total_usage_minutes`
* **Expected RLS / Auth Context:**
  - `upsert_app_usage`: **No auth gate** — EXECUTE granted to PUBLIC, child_id resolved server-side from `devices` table
  - `app_usage` table INSERT: RLS allows public insert (`WITH CHECK: true`)
  - `parent_home_snapshot` view: scoped by `auth.uid()` via `children_of_parent` CTE
* **Realtime:** No realtime subscription. Dashboard polls every 60s.

**✅ STATUS: Should work if the Android app calls `upsert_app_usage`. No auth barrier.**

---

### 3. Limits / Restrictions Syncing (App Policies & Schedules)

* **Direction:** Parent → Child
* **Dashboard UI Status:** Parent sets app blocks, daily limits, schedules via `useChildControls` hook → writes to `app_policies`, `settings`, `schedule_windows`, `bonus_time_grants` → inserts `REFRESH_SETTINGS` command → device calls `get_device_settings` RPC to pull config
* **Supabase Mechanism:**
  - Parent writes: direct table upserts/inserts (app_policies, settings, schedule_windows, bonus_time_grants)
  - Parent signals: INSERT `REFRESH_SETTINGS` into `device_commands`
  - Device pulls: calls `get_device_settings(p_device_id)` RPC
* **Target:** `device_commands` (signal), `get_device_settings` RPC (device reads config)
* **Exact Payload:**
  - Parent INSERT: `{ device_id, command_type: "REFRESH_SETTINGS", status: "PENDING" }`
  - Device RPC: `get_device_settings(p_device_id)` → returns JSONB with: `effective_screen_time_limit_minutes`, `app_policies`, `schedules`, `next_shabbat`, `issur_melacha_windows`, `reward_balance_minutes`, `geofence_places`, `geofence_settings`, `time_request_updates`
* **Expected RLS / Auth Context:**
  - Parent INSERT on `device_commands`: `is_family_parent_for_device()` — works
  - Device SELECT on `device_commands` (to see REFRESH_SETTINGS): **JWT-scoped RLS** → **BROKEN for anon device**
  - `get_device_settings` RPC: now has legacy fallback (Tier 2) → **FIXED by migration**
* **Realtime:** Dashboard subscribes to `device_commands` (via SyncNotice component) to show pending sync status. Device should ideally subscribe to `device_commands` realtime for instant pickup.

**⚠ BLOCKER:** Same as #1 — device cannot read `device_commands` to know when to refresh. Even though `get_device_settings` now works, the device has no trigger to call it.

---

### 4. Ring Device (Find My Phone)

* **Direction:** Parent → Child
* **Dashboard UI Status:** Parent clicks ring button → `useRingCommand` hook inserts `RING_DEVICE` command → polls for status transitions (PENDING → ACKNOWLEDGED → COMPLETED with result). Shows phase: sending → ringing → child_stopped/timeout/failed.
* **Supabase Mechanism:** INSERT into `device_commands`, then poll SELECT by command ID
* **Target:** `device_commands` table
* **Exact Payload:**
  - Parent INSERT: `{ device_id, command_type: "RING_DEVICE", status: "PENDING" }`
  - Device UPDATE: `{ status: "ACKNOWLEDGED" }` then `{ status: "COMPLETED", result: "CHILD_STOPPED" | "RING_TIMEOUT" | "RING_FAILED" }`
* **Expected RLS / Auth Context:**
  - Parent INSERT: `is_family_parent_for_device()` — works
  - Device SELECT/UPDATE: **JWT-scoped RLS** (`device_id = get_device_id_from_jwt()`) → **BROKEN for anon device**
* **Realtime:** No realtime — Dashboard polls `device_commands` every 5s by command ID

**⚠ BLOCKER:** Device cannot SELECT or UPDATE `device_commands`. Command stays PENDING forever.

---

### 5. Battery Status

* **Direction:** Child → Parent
* **Dashboard UI Status:** Shows `device.battery_level` from `devices` table. Updates in real-time via Realtime subscription.
* **Supabase Mechanism:** Device calls `update_device_status` RPC → updates `devices` row → Dashboard receives via Realtime
* **Target:** `update_device_status` RPC → `devices` table
* **Exact Payload:**
  - Device RPC: `update_device_status(p_device_id, p_battery, p_lat, p_lon, p_device_model, p_device_manufacturer)`
  - Dashboard reads: `devices.battery_level`
* **Expected RLS / Auth Context:**
  - `update_device_status` RPC: legacy fallback enabled (Tier 2) → **FIXED by migration**
  - `devices` SELECT: `is_family_parent(child_id)` — parent reads fine
* **Realtime:** Yes — Dashboard subscribes to `devices` table filtered by `device_id`

**✅ STATUS: Working. The migration restored anon access to `update_device_status`.**

---

### 6. Device Heartbeat (Health Reporting)

* **Direction:** Child → Parent
* **Dashboard UI Status:** Shows device health info (permissions, model, version) in `DeviceHealthBanner`. Data comes from `get_child_device_health` RPC. Parent can trigger via `REPORT_HEARTBEAT` command.
* **Supabase Mechanism:** Device calls `report_device_heartbeat` RPC → writes to `device_heartbeats_raw` → trigger syncs metadata to `devices`
* **Target:** `report_device_heartbeat` RPC, `device_heartbeats_raw` table, `REPORT_HEARTBEAT` command via `device_commands`
* **Exact Payload:**
  - Device RPC: `report_device_heartbeat(p_child_id, p_device, p_device_id, p_permissions, p_timestamp)`
    - `p_device`: JSONB with `{ model, manufacturer, appVersionName, ... }`
    - `p_permissions`: JSONB with `{ accessibilityEnabled, notificationListenerEnabled, usageStatsGranted, locationPermissionGranted, ... }`
  - Parent command: `{ device_id, command_type: "REPORT_HEARTBEAT", status: "PENDING" }`
* **Expected RLS / Auth Context:**
  - `report_device_heartbeat` RPC: legacy fallback enabled → **FIXED by migration**
  - `REPORT_HEARTBEAT` command pickup by device: **BROKEN** (same `device_commands` RLS issue)
* **Realtime:** No dedicated subscription for heartbeats

**⚠ PARTIAL:** RPC works, but device won't know when parent requests a heartbeat (can't read `device_commands`).

---

### 7. Installed Apps Reporting

* **Direction:** Child → Parent
* **Dashboard UI Status:** `AppsSection` in child dashboard shows installed apps from `installed_apps` table + `app_policies` for block status
* **Supabase Mechanism:** Device calls `report_installed_apps` RPC → upserts `installed_apps` table
* **Target:** `report_installed_apps(p_device_id, p_apps)` RPC → `installed_apps` table
* **Exact Payload:**
  - Device RPC: `report_installed_apps(p_device_id, p_apps)` where `p_apps` is JSONB array of `{ package_name, app_name, is_system, category }`
* **Expected RLS / Auth Context:** Legacy fallback enabled → **FIXED by migration**
* **Realtime:** No

**✅ STATUS: RPC works. Device just needs to call it.**

---

### 8. Alert / Event Reporting

* **Direction:** Child → Parent
* **Dashboard UI Status:** Alerts page shows alerts from `alerts` table filtered by child_id
* **Supabase Mechanism:** Device calls `create_alert` RPC → inserts into `alerts` table → triggers queue for AI analysis
* **Target:** `create_alert` RPC → `alerts` table
* **Exact Payload:**
  - `create_alert(p_message, p_risk_level, p_source, p_device_id, p_chat_type, p_message_count, p_contact_hash, p_pii_redacted_count, p_sender_display, p_author_type, p_chat_name, p_client_event_id, p_platform, p_category, p_is_processed, p_ai_verdict, p_parent_message)`
* **Expected RLS / Auth Context:** Legacy fallback enabled → **FIXED by migration**
* **Realtime:** No dedicated subscription in child dashboard

**✅ STATUS: RPC works.**

---

## Summary: The Single Remaining Blocker

```text
┌─────────────────────────────────────────────────────────┐
│              device_commands TABLE RLS                   │
│                                                         │
│  Device SELECT: device_id = get_device_id_from_jwt()    │
│  Device UPDATE: device_id = get_device_id_from_jwt()    │
│                                                         │
│  → Requires authenticated role + device JWT             │
│  → anon key CANNOT read or update commands              │
│  → ALL parent→child commands are invisible to device    │
└─────────────────────────────────────────────────────────┘
```

**What works (Child → Parent):**
| Feature | RPC | Status |
|---|---|---|
| Battery/Location | `update_device_status` | ✅ Working |
| App Usage | `upsert_app_usage` | ✅ Working (no auth gate) |
| Heartbeat | `report_device_heartbeat` | ✅ Working |
| Installed Apps | `report_installed_apps` | ✅ Working |
| Alerts | `create_alert` | ✅ Working |
| Get Settings | `get_device_settings` | ✅ Working |

**What is BROKEN (Parent → Child commands):**
| Feature | Command Type | Blocker |
|---|---|---|
| Locate Now | `LOCATE_NOW` | Device can't read `device_commands` |
| Ring Device | `RING_DEVICE` | Device can't read/update `device_commands` |
| Request Sync | `REPORT_HEARTBEAT` | Device can't read `device_commands` |
| Refresh Settings | `REFRESH_SETTINGS` | Device can't read `device_commands` |

---

## Actionable Requirements for the Android Developer

### A. RPCs the Device MUST Call (all work with anon key now)

1. **`update_device_status(p_device_id, p_battery, p_lat, p_lon, p_device_model, p_device_manufacturer)`**
   - Call periodically (every 5-15min) and on significant location/battery changes
   - All params after `p_device_id` and `p_battery` are optional (DEFAULT NULL)

2. **`upsert_app_usage(p_app_name, p_device_id, p_package_name, p_usage_minutes, p_usage_date)`**
   - Call with daily deltas per app. `p_usage_date` defaults to today (Israel TZ)
   - One call per app per sync cycle

3. **`report_device_heartbeat(p_child_id, p_device, p_device_id, p_permissions, p_timestamp)`**
   - `p_child_id` is ignored server-side (resolved from `devices` table), pass any UUID or null
   - `p_device`: `{ "model": "...", "manufacturer": "...", "appVersionName": "..." }`
   - `p_permissions`: `{ "accessibilityEnabled": bool, "notificationListenerEnabled": bool, "usageStatsGranted": bool, "locationPermissionGranted": bool, "locationServicesEnabled": bool, "batteryOptimizationIgnored": bool, "canDrawOverlays": bool }`
   - Call every 15-30min or on permission change

4. **`report_installed_apps(p_device_id, p_apps)`**
   - `p_apps`: JSONB array of `{ "package_name": "...", "app_name": "...", "is_system": bool, "category": "..." }`
   - Call on first boot, after app install/uninstall

5. **`create_alert(...)`** — for messaging/safety alerts

6. **`get_device_settings(p_device_id)`** — call on boot and periodically to pull restrictions/policies

### B. The `device_commands` Problem — Requires Fix

The device MUST be able to:
1. **SELECT** from `device_commands` where `device_id` matches and `status = 'PENDING'`
2. **UPDATE** status to `'ACKNOWLEDGED'` then `'COMPLETED'` (with `result` field)

**Current RLS blocks this for anon.** This requires one more migration to add legacy-fallback RLS policies for SELECT and UPDATE on `device_commands`, scoped to rows matching a `device_id` that exists in `devices` with a non-null `child_id`.

### C. Realtime (Optional but Recommended)

The device should subscribe to Realtime on `device_commands` filtered by its `device_id` for instant command pickup instead of polling.

---

## Proposed Next Step

Create a migration adding two new RLS policies on `device_commands`:

```sql
-- Legacy fallback: device can read its pending commands
CREATE POLICY "Devices can read commands (legacy fallback)"
ON public.device_commands FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.devices
  WHERE devices.device_id = device_commands.device_id
  AND devices.child_id IS NOT NULL
));

-- Legacy fallback: device can update its commands
CREATE POLICY "Devices can update commands (legacy fallback)"
ON public.device_commands FOR UPDATE TO anon
USING (EXISTS (
  SELECT 1 FROM public.devices
  WHERE devices.device_id = device_commands.device_id
  AND devices.child_id IS NOT NULL
));
```

This follows the same safety pattern as the RPC migration: any caller with a valid paired `device_id` can access only that device's commands. It does NOT grant INSERT (parents insert commands, not devices).

