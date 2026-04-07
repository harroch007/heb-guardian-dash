# Phase 4B: Harden `update_device_status` — Device-Only Fail-Closed + Safe Overload Consolidation

## Root Cause

**Insecure trust path**: Both overloads of `update_device_status` accept a bare `p_device_id` parameter and blindly update the corresponding device row. No JWT validation. Any caller with EXECUTE could spoof any `device_id`.

**Overload ambiguity**: Two live overloads exist:

- 4-param: `(p_device_id, p_battery, p_lat, p_lon)` — legacy
- 6-param: `(p_device_id, p_battery, p_lat, p_lon, p_device_model DEFAULT NULL, p_device_manufacturer DEFAULT NULL)` — newer superset

The 6-param version is the **authoritative** contract.  
The 4-param version should not remain an independent logic path.

**Grant gap**: EXECUTE must not remain open to `PUBLIC` / `anon`.

## Fix — One Migration

### Step 1: Replace the 6-param overload with a fail-closed device-only authoritative version

Same signature, same `SECURITY DEFINER`, but with the three-step authorization gate (matching the approved `get_device_settings` pattern) and **no insert-on-missing fallback**:

```
CREATE OR REPLACE FUNCTION public.update_device_status(
  p_device_id text,
  p_battery integer,
  p_lat double precision,
  p_lon double precision,
  p_device_model text DEFAULT NULL,
  p_device_manufacturer text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_jwt_role text;
  v_jwt_device_id text;
BEGIN
  -- Fail-closed authorization gate: device-only
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

  UPDATE public.devices
  SET
    first_seen_at       = COALESCE(first_seen_at, now()),
    last_seen           = now(),
    battery_level       = p_battery,
    latitude            = p_lat,
    longitude           = p_lon,
    device_model        = COALESCE(p_device_model, device_model),
    device_manufacturer = COALESCE(p_device_manufacturer, device_manufacturer)
  WHERE device_id = p_device_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEVICE_NOT_FOUND_OR_NOT_PAIRED';
  END IF;
END;
$$;
```

### Step 2: Keep the 4-param overload only as a compatibility shim to the authoritative 6-param path

This keeps migration safety while removing logic ambiguity:

```
CREATE OR REPLACE FUNCTION public.update_device_status(
  p_device_id text,
  p_battery integer,
  p_lat double precision,
  p_lon double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.update_device_status(
    p_device_id,
    p_battery,
    p_lat,
    p_lon,
    NULL,
    NULL
  );
END;
$$;
```

### Step 3: Lock down EXECUTE grants on both overloads

```
REVOKE EXECUTE ON FUNCTION public.update_device_status(text, integer, double precision, double precision) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_device_status(text, integer, double precision, double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_device_status(text, integer, double precision, double precision) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_device_status(text, integer, double precision, double precision, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_device_status(text, integer, double precision, double precision, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_device_status(text, integer, double precision, double precision, text, text) TO authenticated;
```

## Access Matrix After Fix


| Caller                                         | Result                       | Path                                                                         |
| ---------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| Device A → device A (6-param)                  | Allowed                      | `auth.role()=authenticated`, `app_metadata.role=device`, `device_id` matches |
| Device A → device B (6-param)                  | Denied                       | `RAISE EXCEPTION 'DEVICE_ID_MISMATCH'`                                       |
| Authenticated parent/admin                     | Denied                       | `RAISE EXCEPTION 'UNAUTHORIZED'` (`role != device`)                          |
| service_role/internal                          | Denied through this function | `auth.role() != authenticated` → `UNAUTHORIZED`                              |
| anon                                           | Denied                       | EXECUTE revoked                                                              |
| Legacy 4-param caller with correct device JWT  | Allowed                      | 4-param shim delegates into authoritative 6-param function                   |
| Legacy 4-param caller without valid device JWT | Denied                       | shim delegates into 6-param fail-closed gate                                 |


## Files Changed

-   
One new migration file in `supabase/migrations/`  

- `.lovable/plan.md` — update Phase 4B status  


## Android Impact

No Android code changes required.

-   
Current Android can keep using the 6-param signature.  

-   
If any unexpected legacy caller still uses the 4-param overload, it remains safe and functional through the compatibility shim.  

-   
There is now **one authoritative logic path** only: the 6-param function.  


## Scope Confirmation

Only `update_device_status` is touched. No changes to:

- `get_device_settings`  

- `device_commands`  

- `report_device_heartbeat`  

- `create_alert`  

- `report_installed_apps`  

-   
bootstrap  

-   
recovery flows  


---

&nbsp;