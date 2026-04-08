

# Phase 4C: Harden `create_alert` — Device-Only Fail-Closed

## Root Cause

**Insecure trust path**: `create_alert` accepts a bare `p_device_id` and blindly uses it to look up the child, stamp `first_seen_at`, and insert an alert row. No JWT validation. Any caller can spoof any device_id.

**Grant gap**: `EXECUTE` is granted to `PUBLIC`, meaning even `anon` can call it.

## Fix — One Migration

### Step 1: Replace `create_alert` with fail-closed device-only version

Insert the three-step authorization gate (matching the approved pattern) at the top of the function body, before any data access. Signature, return type, and all payload logic remain identical.

```sql
CREATE OR REPLACE FUNCTION public.create_alert(
  p_message text,
  p_risk_level integer,
  p_source text,
  p_device_id text,
  p_chat_type text DEFAULT 'PRIVATE',
  p_message_count integer DEFAULT 0,
  p_contact_hash text DEFAULT NULL,
  p_pii_redacted_count integer DEFAULT 0,
  p_sender_display text DEFAULT NULL,
  p_author_type text DEFAULT 'UNKNOWN',
  p_chat_name text DEFAULT NULL,
  p_client_event_id text DEFAULT NULL,
  p_platform text DEFAULT 'WHATSAPP',
  p_category text DEFAULT NULL,
  p_is_processed boolean DEFAULT false,
  p_ai_verdict text DEFAULT NULL,
  p_parent_message text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_jwt_role text;
    v_jwt_device_id text;
    v_child_id UUID;
    v_alert_id BIGINT;
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

    -- Authorized: proceed with existing logic
    UPDATE public.devices
    SET first_seen_at = COALESCE(first_seen_at, now())
    WHERE device_id = p_device_id;

    SELECT child_id INTO v_child_id
    FROM devices
    WHERE device_id = p_device_id;

    INSERT INTO alerts (
        content, risk_score, sender, sender_display,
        device_id, chat_type, message_count, child_id,
        is_processed, should_alert, author_type, chat_name,
        client_event_id, platform, category, ai_verdict,
        parent_message
    ) VALUES (
        p_message, p_risk_level, p_source, p_sender_display,
        p_device_id, p_chat_type, p_message_count, v_child_id,
        p_is_processed, true, p_author_type, p_chat_name,
        p_client_event_id, p_platform, p_category, p_ai_verdict,
        p_parent_message
    )
    ON CONFLICT (device_id, client_event_id, platform)
        WHERE client_event_id IS NOT NULL
    DO UPDATE SET content = alerts.content
    RETURNING id INTO v_alert_id;

    RETURN v_alert_id;
END;
$$;
```

### Step 2: Lock down EXECUTE grants

```sql
REVOKE EXECUTE ON FUNCTION public.create_alert(
  text, integer, text, text, text, integer, text, integer,
  text, text, text, text, text, text, boolean, text, text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.create_alert(
  text, integer, text, text, text, integer, text, integer,
  text, text, text, text, text, text, boolean, text, text
) FROM anon;

GRANT EXECUTE ON FUNCTION public.create_alert(
  text, integer, text, text, text, integer, text, integer,
  text, text, text, text, text, text, boolean, text, text
) FROM authenticated;
```

## Access Matrix After Fix

| Caller | Result | Path |
|---|---|---|
| Device A → alert for device A | Allowed | All three gates pass |
| Device A → alert for device B | Denied | `RAISE EXCEPTION 'DEVICE_ID_MISMATCH'` |
| Authenticated parent/admin | Denied | `RAISE EXCEPTION 'UNAUTHORIZED'` (role != device) |
| service_role/internal | Denied | `RAISE EXCEPTION 'UNAUTHORIZED'` (auth.role() != authenticated) |
| anon | Denied | EXECUTE revoked |

## Files Changed

- One new migration file in `supabase/migrations/`
- `.lovable/plan.md` — update Phase 4C status

## Android Impact

None. The function signature is unchanged. Android already calls with its device JWT session.

## Scope Confirmation

Only `create_alert` is touched. No changes to `get_device_settings`, `device_commands`, `update_device_status`, `report_device_heartbeat`, `report_installed_apps`, bootstrap, or recovery flows.

