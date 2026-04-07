# Phase 4A Blocker Fix: Fail-Closed `get_device_settings`

## Root Cause

The current authorization block (lines 26-32 of function body):

```
v_jwt_role := (auth.jwt() -> 'app_metadata' ->> 'role');
IF v_jwt_role = 'device' THEN
    v_jwt_device_id := public.get_device_id_from_jwt();
    IF v_jwt_device_id IS NULL OR v_jwt_device_id != p_device_id THEN
        RETURN jsonb_build_object('error', 'DEVICE_ID_MISMATCH', 'success', false);
    END IF;
END IF;
```

Only validates when `role = 'device'`. Any authenticated user with a different or missing role skips the gate entirely.

## Fix

One migration file. Replace the authorization block with a strict device-only fail-closed gate:

```
-- Fail-closed authorization gate: this function is device-facing only
IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED', 'success', false);
END IF;

v_jwt_role := (auth.jwt() -> 'app_metadata' ->> 'role');
IF v_jwt_role IS DISTINCT FROM 'device' THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED', 'success', false);
END IF;

v_jwt_device_id := public.get_device_id_from_jwt();
IF v_jwt_device_id IS NULL OR v_jwt_device_id != p_device_id THEN
    RETURN jsonb_build_object('error', 'DEVICE_ID_MISMATCH', 'success', false);
END IF;
```

### Logic

1. `auth.role()` must be exactly `authenticated`.  

2.   
The JWT app_metadata role must be exactly `'device'`.  

3.   
The JWT device_id must match `p_device_id`.  

4.   
Any other caller is denied fail-closed.  


### Access Matrix


| Caller                     | Result                       | Path                                                                |
| -------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| Device A → device A        | Allowed                      | role=authenticated → app_metadata.role=device → id matches          |
| Device A → device B        | Denied                       | role=authenticated → role=device → id mismatch → DEVICE_ID_MISMATCH |
| Authenticated parent/admin | Denied                       | role=authenticated → app_metadata.role≠device → UNAUTHORIZED        |
| service_role/internal      | Denied through this function | auth.role() ≠ authenticated → UNAUTHORIZED                          |
| anon                       | Denied                       | EXECUTE revoked (previous migration)                                |


## Scope

- **One migration**: `CREATE OR REPLACE FUNCTION public.get_device_settings(p_device_id text)` with only the authorization block changed. Rest of function body identical.  

- **No GRANT/REVOKE changes** — keep the previous EXECUTE state from the last approved step.  

- **No other files touched**.  


## Technical Detail: why this version is safer

This keeps `get_device_settings` as a pure Android device-facing contract and removes any dependence on an unproven assumption about how `auth.jwt()` behaves for service-role callers. Supabase documents that JWT claims are the basis for authorization decisions, while the `service_role` key maps to the `service_role` Postgres role and bypasses RLS. 

---

&nbsp;