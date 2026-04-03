## Geofence Phase 1 — Foundation Plan

### Current Model (Before Changes)

**Location data**: Lives on `devices` table (`latitude`, `longitude`, `address`, `last_seen`). Updated by Android heartbeats. No place/geofence table exists anywhere.

**Child/device relationship**: `devices.child_id` → `children.id`. `children.parent_id` → owner. Co-parent access via `is_family_parent(child_id)`.

**Schedule windows**: `schedule_windows` table with `schedule_type` values: `shabbat`, `bedtime`, `school`. Already has bedtime and school schedule concepts. UI in `SchedulesSection.tsx`.

**Settings RPC**: `get_device_settings(p_device_id)` is the central RPC Android consumes. Returns settings, app policies, schedules, bonus time, issur melacha windows, reward bank. This is the natural extension point for geofence data.

**No place/geofence structure exists today.** No home/school coordinates stored anywhere.

---

### Schema Changes

#### New table: `child_places`

```sql
CREATE TABLE public.child_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  place_type TEXT NOT NULL CHECK (place_type IN ('HOME', 'SCHOOL')),
  label TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL CHECK (radius_meters > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active place per type per child
CREATE UNIQUE INDEX uq_child_place_active
  ON child_places (child_id, place_type)
  WHERE is_active = true;

-- Auto-update timestamp (use the same existing project pattern/function already used elsewhere;
-- do not assume moddatetime(updated_at) exists unless confirmed in the current schema)

```

**Important default handling**:

- Do **not** rely on one DB default radius for both place types
- UI/hook insert logic must explicitly set:
  - `HOME` → `150`
  - `SCHOOL` → `250`

**RLS policies** (using existing `is_family_parent`):

- SELECT: `is_family_parent(child_id)` + admin
- INSERT: `is_family_parent(child_id)`
- UPDATE: `is_family_parent(child_id)`
- DELETE: `is_family_parent(child_id)`

Both owner and co-parent can manage places (operational, not destructive).

#### New table: `child_geofence_settings`

```sql
CREATE TABLE public.child_geofence_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE UNIQUE,
  home_exit_alert_enabled BOOLEAN NOT NULL DEFAULT true,
  school_exit_alert_enabled BOOLEAN NOT NULL DEFAULT true,
  exit_debounce_seconds INTEGER NOT NULL DEFAULT 120 CHECK (exit_debounce_seconds > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

```

One row per child. Defaults: both alerts enabled, 120-second debounce.

Same RLS pattern as `child_places`.

**Timestamp handling**:

- `child_geofence_settings.updated_at` must also follow the same existing project timestamp-update pattern
- Do not add a new trigger style unless it matches the current schema conventions

#### Extend `get_device_settings` RPC

Add two new keys to the returned JSON:

- `"geofence_places"`: array of `{place_type, label, latitude, longitude, radius_meters}` from `child_places` where `is_active = true`
- `"geofence_settings"`: object `{home_exit_alert_enabled, school_exit_alert_enabled, exit_debounce_seconds}` from `child_geofence_settings` (with safe defaults if no row exists)

This is the exact path Android already uses. No new RPC needed.

---

### Android-Facing Read Path

Android calls `get_device_settings(device_id)` and will now also receive:

```json
{
  "geofence_places": [
    { "place_type": "HOME", "label": "בית", "latitude": 31.77, "longitude": 35.21, "radius_meters": 150 },
    { "place_type": "SCHOOL", "label": "בית ספר", "latitude": 31.78, "longitude": 35.22, "radius_meters": 250 }
  ],
  "geofence_settings": {
    "home_exit_alert_enabled": true,
    "school_exit_alert_enabled": true,
    "exit_debounce_seconds": 120
  }
}

```

If no places or settings exist → empty array and default object. Fully backward compatible.

---

### V2 UI

**Chosen surface**: Add a new `GeofenceSection` component inside `ChildControlV2.tsx`, placed after the Location section and before the Tasks section. This is the natural location — it's the child management page where location, schedules, and apps are already managed.

**Component**: `src/components/child-dashboard/GeofenceSection.tsx`

Features:

- Collapsible card (same pattern as LocationSectionV2, SchedulesSection)
- Title: "גדר גיאוגרפית" with a MapPin icon
- Two sub-sections: בית (Home) and בית ספר (School)
- Each shows: current status (configured / not configured), coordinates summary, radius input
- "הגדר מיקום" button to set coordinates — uses the device's current location as default suggestion, or manual lat/lng entry
- Toggle switches for exit alerts (home_exit_alert_enabled, school_exit_alert_enabled)
- Debounce value shown as a simple selector (60s / 120s / 180s)
- Uses `is_family_parent` RLS — both owner and co-parent can manage

**Data hook**: `src/hooks/useChildPlaces.ts` — fetches and mutates `child_places` and `child_geofence_settings` for a given child_id.

**Coordinate entry**: Simple lat/lng input fields with a "Use current device location" button that pre-fills from the device's last known coordinates on `devices`, and can optionally show the current device address as context if already available. No heavy map picker — keeps it foundation-level.

**Save behavior**:

- If place does not exist yet, insert with explicit radius default by place type
- If place exists, update in place
- If geofence settings row does not exist yet, create it lazily on first settings save

---

### Defaults


| Setting           | Default     |
| ----------------- | ----------- |
| Home radius       | 150m        |
| School radius     | 250m        |
| Home exit alert   | enabled     |
| School exit alert | enabled     |
| Exit debounce     | 120 seconds |


---

### Backward Compatibility

- If no `child_places` rows exist → `geofence_places` returns `[]` in `get_device_settings`
- If no `child_geofence_settings` row exists → returns safe defaults in the RPC
- UI shows "לא הוגדר" (not configured) state cleanly
- No existing table/RPC is broken — only additive changes
- Single-parent accounts unaffected
- Android/device flows remain unchanged until Android phase 2 consumes the new fields

---

### Files Changed


| File                                                 | Change                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Migration SQL                                        | New `child_places` table, `child_geofence_settings` table, RLS policies, updated `get_device_settings` |
| `src/hooks/useChildPlaces.ts`                        | New — CRUD hook for places + geofence settings                                                         |
| `src/components/child-dashboard/GeofenceSection.tsx` | New — UI section for Home/School place management                                                      |
| `src/pages/ChildControlV2.tsx`                       | Import and render GeofenceSection after LocationSectionV2                                              |


### What This Does NOT Build

- No Android geofence detection
- No alert sending from device
- No manual/arbitrary places
- No arrival alerts
- No location history or route tracking
- No map picker product
- No notification delivery logic