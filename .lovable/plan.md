## Geofence Phase 3: Manual Places Foundation

### Current Model (Before Changes)

`child_places` **table:**

- Columns: `id`, `child_id`, `place_type` (CHECK: HOME/SCHOOL), `label` (nullable), `latitude`, `longitude`, `radius_meters` (CHECK > 0), `is_active`, `created_at`, `updated_at`
- Unique index: `uq_child_place_active ON (child_id, place_type) WHERE is_active = true` — enforces one active HOME and one active SCHOOL per child
- RLS: `is_family_parent(child_id)` for SELECT/INSERT/UPDATE/DELETE + admin SELECT

`child_geofence_settings` **table:**

- Columns: `id`, `child_id` (UNIQUE), `home_exit_alert_enabled`, `school_exit_alert_enabled`, `exit_debounce_seconds`, `created_at`, `updated_at`

`get_device_settings` **RPC geofence payload:**

- `geofence_places`: array of `{place_type, label, latitude, longitude, radius_meters}` — all active places for child
- `geofence_settings`: `{home_exit_alert_enabled, school_exit_alert_enabled, exit_debounce_seconds}`

**Android risk:** Current Android decodes `geofence_places` and expects HOME/SCHOOL `place_type` values. If MANUAL rows appear in `geofence_places`, Android would receive unknown `place_type` values. Current Android decoder behavior is unknown — safest approach is to **not include MANUAL places in the existing** `geofence_places` **key**.

**Current UI:** `GeofenceSection` uses `useChildPlaces` hook. The hook types `place_type` as `"HOME" | "SCHOOL"` and `getPlace()` only accepts those values. PlaceCard is hardcoded for HOME/SCHOOL with those two cards.

---

### Plan

#### 1. Migration: Extend `child_places` table

**Modify CHECK constraint** on `place_type` to allow `'MANUAL'`:

```sql
ALTER TABLE child_places DROP CONSTRAINT child_places_place_type_check;
ALTER TABLE child_places ADD CONSTRAINT child_places_place_type_check 
  CHECK (place_type IN ('HOME', 'SCHOOL', 'MANUAL'));

```

**Add new columns** (all nullable with defaults, so existing rows unaffected):

```sql
ALTER TABLE child_places ADD COLUMN alert_on_enter BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE child_places ADD COLUMN alert_on_exit BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE child_places ADD COLUMN schedule_mode TEXT NOT NULL DEFAULT 'ALWAYS' 
  CHECK (schedule_mode IN ('ALWAYS', 'SCHEDULED'));
ALTER TABLE child_places ADD COLUMN days_of_week SMALLINT[] DEFAULT NULL;
ALTER TABLE child_places ADD COLUMN start_time TIME DEFAULT NULL;
ALTER TABLE child_places ADD COLUMN end_time TIME DEFAULT NULL;

```

**Add validation constraints** for MANUAL places:

- If `place_type = 'MANUAL'`, `label` must not be null/empty
- If `schedule_mode = 'SCHEDULED'`, `days_of_week` must not be empty, `start_time` and `end_time` must not be null
- Match the existing project convention for weekday numbering already used in current schedule code; do not invent a new day mapping

**Unique index unchanged** — `uq_child_place_active ON (child_id, place_type) WHERE is_active = true` only constrains one active HOME and one active SCHOOL. Multiple MANUAL rows are allowed because the unique index is on `(child_id, place_type)` — wait, this would block multiple active MANUAL places since they all share `place_type = 'MANUAL'`.

**Fix:** Drop and recreate the unique index to only apply to HOME and SCHOOL:

```sql
DROP INDEX uq_child_place_active;
CREATE UNIQUE INDEX uq_child_place_active 
  ON child_places (child_id, place_type) 
  WHERE is_active = true AND place_type IN ('HOME', 'SCHOOL');

```

**RLS:** No changes needed — existing `is_family_parent(child_id)` policies already cover MANUAL places for owner + co-parent.

#### 2. Extend `get_device_settings` RPC

**Keep existing** `geofence_places` **unchanged** — only HOME/SCHOOL, same shape. Android safe.

**Add new key** `manual_geofence_places` — separate top-level array:

```sql
SELECT COALESCE(jsonb_agg(
  jsonb_build_object(
    'id', cp.id,
    'label', cp.label,
    'latitude', cp.latitude,
    'longitude', cp.longitude,
    'radius_meters', cp.radius_meters,
    'is_active', cp.is_active,
    'alert_on_enter', cp.alert_on_enter,
    'alert_on_exit', cp.alert_on_exit,
    'schedule_mode', cp.schedule_mode,
    'days_of_week', cp.days_of_week,
    'start_time', cp.start_time,
    'end_time', cp.end_time
  )
), '[]'::jsonb)
FROM child_places cp
WHERE cp.child_id = v_child_id 
  AND cp.is_active = true 
  AND cp.place_type = 'MANUAL';

```

Existing `geofence_places` query gets filtered to `place_type IN ('HOME','SCHOOL')` explicitly.

#### 3. Extend `useChildPlaces` hook

- Update `ChildPlace` type to include new fields
- Add `place_type: "HOME" | "SCHOOL" | "MANUAL"`
- Add `manualPlaces` derived list (filtered from `places`)
- Add `upsertManualPlace()` — create/update a MANUAL place
- Add `deactivateManualPlace(id)` — soft-disable by setting `is_active = false`
- Add `toggleManualPlace(id, patch)` — update alert toggles, schedule, etc.
- Keep existing `getPlace("HOME")`, `getPlace("SCHOOL")`, `upsertPlace`, `deletePlace` unchanged for the current HOME/SCHOOL flow

#### 4. Extend `GeofenceSection` UI

Add a third subsection **"מקומות נוספים"** below the existing Home/School cards and settings:

- **List of manual places** — each shows: label, coords summary, radius, enter/exit toggles, always/scheduled badge, edit/deactivate buttons
- **"הוסף מקום" button** — opens inline form:
  - Label (text input, required)
  - Coordinates input using the same lightweight pattern as the current HOME/SCHOOL flow: manual lat/lng + "מיקום המכשיר" prefill
  - Radius selector (same as HOME/SCHOOL)
  - Alert on enter toggle
  - Alert on exit toggle
  - Schedule mode: ALWAYS / SCHEDULED radio
  - If SCHEDULED: day checkboxes + start_time + end_time (reuse existing time/day input pattern if already present in the project)
- **Edit flow** — same form, prefilled
- **Deactivate/Remove** — deactivate button per place (`is_active = false`), not a heavy hard-delete flow

No new pages. No heavy map. RTL Hebrew throughout.

#### 5. Scheduling model

- `schedule_mode = 'ALWAYS'`: place is always monitored. `days_of_week`, `start_time`, `end_time` are null.
- `schedule_mode = 'SCHEDULED'`: place monitored only during specified windows. `days_of_week` uses the same weekday convention already used elsewhere in the project. `start_time` and `end_time` = TIME values.
- One schedule window per place. No multiple windows. No holiday overrides.

#### 6. Backward compatibility proof

- HOME/SCHOOL rows: new columns get defaults (`alert_on_enter=false`, `alert_on_exit=true`, `schedule_mode='ALWAYS'`). No behavior change.
- Unique index: recreated to only constrain HOME/SCHOOL. Multiple MANUAL places allowed.
- `geofence_places` RPC key: filtered to HOME/SCHOOL only. Android sees no change.
- `manual_geofence_places`: new key. Current Android ignores unknown JSON keys.
- `useChildPlaces` hook: existing HOME/SCHOOL methods unchanged. New methods are additive.
- `GeofenceSection`: existing PlaceCard for HOME/SCHOOL untouched. New section appended below.

---

### Files Changed


| File                                                 | Change                                                  |
| ---------------------------------------------------- | ------------------------------------------------------- |
| New migration SQL                                    | Schema changes: columns, constraints, index, RPC update |
| `src/hooks/useChildPlaces.ts`                        | Extended types, added manual place CRUD methods         |
| `src/components/child-dashboard/GeofenceSection.tsx` | Added "מקומות נוספים" subsection with list + form       |


### What This Phase Completes

- Backend data model for manual places
- Android-facing read path via `manual_geofence_places`
- Parent UI to create/edit/deactivate manual places with scheduling
- Full backward compatibility with HOME/SCHOOL

### What Remains

- Android detection of manual geofences (next Android phase)
- Push notification delivery for manual place enter/exit events
- Location history / route tracking (out of scope)