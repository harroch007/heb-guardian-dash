

## Audit Results: Stale `installed_apps` Rows

### 1. `report_installed_apps` — Exact Behavior

```sql
-- UPSERT ONLY. Never deletes.
FOR v_app IN SELECT * FROM jsonb_array_elements(p_apps)
LOOP
  INSERT INTO installed_apps (child_id, package_name, app_name, is_system, last_seen_at)
  VALUES (v_child_id, ...)
  ON CONFLICT (child_id, package_name)
  DO UPDATE SET
    app_name = COALESCE(EXCLUDED.app_name, installed_apps.app_name),
    is_system = EXCLUDED.is_system,
    last_seen_at = now();
END LOOP;
```

**It performs upsert-only. It never deletes rows not included in the latest payload.** Old packages remain forever.

### 2. Current `installed_apps` State

| Metric | Value |
|--------|-------|
| Total rows | **428** |
| `is_system = true` | **0** |
| `is_system = false` | **428** |
| Distinct `last_seen_at` batches | **2** |
| Batch 1: `20:42:59` | 11 rows (latest filtered upload from Android) |
| Batch 2: `20:42:41` | 417 rows (old unfiltered upload) |

The 11 rows with the newer timestamp are the filtered re-upload. The 417 rows with the older timestamp are **stale leftovers from the bad baseline upload** — they were not included in the new payload, so they were never touched or deleted.

Sample stale packages still present: `com.android.cts.priv.ctsshim`, `com.sec.android.app.parser` (DRParser Mode), `com.android.dynsystem` (Dynamic System Updates), `com.samsung.internal.systemui.navbar.gestural_no_hint_wide_back`, `com.sec.android.app.setupwizardlegalprovider`, `com.android.providers.telephony`.

### 3. Root Cause

**Primary cause: `report_installed_apps` does not delete rows missing from the latest payload.**

The new filtered Android upload correctly sent ~11 user-facing apps. Those 11 got their `last_seen_at` bumped. The remaining 417 stale system packages from the old upload remain untouched because the RPC has no deletion logic.

### 4. Safe Cleanup Target

```sql
DELETE FROM installed_apps
WHERE child_id = '6233e88a-0212-4682-a350-442681e95a5f'
  AND last_seen_at < '2026-03-09T20:42:59+00'::timestamptz;
```

This deletes only the 417 stale rows for this specific child whose `last_seen_at` is older than the latest upload batch. It does not affect other children/devices.

### 5. Sharp Verdicts

| Question | Answer |
|----------|--------|
| Stale `installed_apps` rows exist | **Yes — 417 stale rows** |
| `report_installed_apps` is full-replace | **No — upsert-only, no delete** |
| Cleanup needed before retest | **Yes** |
| Exact cleanup condition identified | **Yes — `child_id = '6233e88a-...' AND last_seen_at < '2026-03-09T20:42:59+00'`** |

### Structural Fix Needed (future)

The RPC should be modified to delete rows not present in the latest payload (full-snapshot semantics). Without this, every subsequent sync will accumulate stale packages if Android ever removes an app from its report. Proposed pattern:

```sql
-- After the upsert loop, delete rows NOT in the current payload:
DELETE FROM installed_apps
WHERE child_id = v_child_id
  AND package_name NOT IN (
    SELECT p->>'package_name' FROM jsonb_array_elements(p_apps) AS p
  );
```

This is out of scope for now per instructions but is the permanent fix.

