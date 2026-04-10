

## Temporary Device Compatibility Path — Plan

### Problem
All 5 Android-facing RPCs require `authenticated` role + `app_metadata.role = 'device'` JWT. The Android app currently calls with the `anon` key (no bootstrap done), resulting in `permission denied` (42501) for all device telemetry.

### Solution
One migration that does two things for each of the 5 RPCs:

1. **Grant EXECUTE to `anon`** — so PostgREST allows the call through
2. **Replace the 3-step JWT gate** with a 2-tier gate:
   - **Tier 1 (JWT path)**: If caller is `authenticated` with `app_metadata.role = 'device'` and JWT `device_id` matches `p_device_id` → allow (same as today)
   - **Tier 2 (legacy fallback)**: If Tier 1 fails, check that `p_device_id` exists in `devices` table AND has a non-null `child_id` → allow

All child_id resolution remains server-side from the `devices` table. No client-supplied child_id is trusted.

### Files Changed
- 1 new migration file: `supabase/migrations/<timestamp>_temp_device_compat.sql`
- No application code changes

### Exact Compatibility Rule Per Function

| Function | JWT Path (Tier 1) | Legacy Fallback (Tier 2) | Safety Condition |
|---|---|---|---|
| `update_device_status` | auth + device role + JWT device_id match | `p_device_id` exists in `devices` with non-null `child_id` | Device must be paired |
| `report_device_heartbeat` | Same | Same | Same |
| `report_installed_apps` | Same | Same | Same |
| `create_alert` | Same | Same | Same |
| `get_device_settings` | Same | Same | Same |

### Exact SQL (Authorization Block — Before/After)

**BEFORE** (same pattern in all 5):
```sql
IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
END IF;
v_jwt_role := (auth.jwt() -> 'app_metadata' ->> 'role');
IF v_jwt_role IS DISTINCT FROM 'device' THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
END IF;
v_jwt_device_id := public.get_device_id_from_jwt();
IF v_jwt_device_id IS NULL OR v_jwt_device_id != p_device_id THEN
    RAISE EXCEPTION 'DEVICE_ID_MISMATCH';
END IF;
```

**AFTER** (same pattern in all 5):
```sql
v_jwt_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
v_jwt_device_id := public.get_device_id_from_jwt();

IF v_jwt_role = 'device' AND v_jwt_device_id = p_device_id THEN
    -- Tier 1: JWT-authenticated device — proceed
    NULL;
ELSE
    -- Tier 2: Legacy fallback — verify device exists and is paired
    IF NOT EXISTS (
        SELECT 1 FROM public.devices
        WHERE device_id = p_device_id AND child_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'UNAUTHORIZED';
    END IF;
END IF;
```

Plus at the end of the migration:
```sql
GRANT EXECUTE ON FUNCTION public.update_device_status(text, integer, double precision, double precision, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.report_device_heartbeat(uuid, jsonb, text, jsonb, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.report_installed_apps(text, uuid, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.create_alert(...) TO anon;
GRANT EXECUTE ON FUNCTION public.get_device_settings(text) TO anon;
```

### Safety Boundaries

**Remains JWT-only (NOT touched):**
- `device_commands` table RLS — still requires `get_device_id_from_jwt()` match
- All parent-side flows (RLS policies using `is_family_parent`, `auth.uid()`)
- All admin-side flows (RLS policies using `is_admin()`)

**Temporarily reopened (legacy fallback):**
- `update_device_status` — anon can call if device_id is paired
- `report_device_heartbeat` — anon can call if device_id is paired
- `report_installed_apps` — anon can call if device_id is paired
- `create_alert` — anon can call if device_id is paired
- `get_device_settings` — anon can call if device_id is paired

**Why device_commands and parent/admin paths remain hardened:**
- `device_commands` RLS uses `get_device_id_from_jwt()` in its SELECT/UPDATE policies — not changed by this migration
- Parent INSERT on `device_commands` uses `is_family_parent_for_device()` — not changed
- No GRANT to anon is added for any table or non-listed function

### Technical Details
- The migration will `CREATE OR REPLACE` each function with the updated auth block, preserving all business logic unchanged
- The full function body is re-stated in each `CREATE OR REPLACE` to ensure correctness
- I will need to look up the exact parameter signatures for the GRANT statements from `pg_proc`

