

## Plan: Add `app_policies` array to `get_device_settings` response

### Root Cause (confirmed)
The RPC returns only `blocked_apps` (a flat array of package names where `is_blocked = true`). The Android client needs full `app_policies` objects for **all** apps (approved + blocked) to avoid treating unknown apps as `PENDING_APPROVAL`.

### Change

**Single migration**: Redefine `get_device_settings` to add a new `app_policies` key alongside the existing `blocked_apps` (kept for backward compatibility).

New variable `v_app_policies JSONB` built from:

```sql
SELECT COALESCE(jsonb_agg(
  jsonb_build_object(
    'package_name', ap.package_name,
    'policy_status', CASE WHEN ap.is_blocked THEN 'blocked' ELSE 'approved' END,
    'daily_limit_minutes', null
  )
), '[]'::jsonb)
INTO v_app_policies
FROM app_policies ap
WHERE ap.child_id = v_child_id;
```

Injected into settings alongside existing `blocked_apps`:
```sql
v_settings := v_settings || jsonb_build_object(
  'blocked_apps', v_blocked_apps,
  'app_policies', v_app_policies
);
```

`daily_limit_minutes` is `null` for now (no per-app limit column exists yet); the field is included to satisfy the Android contract and allow future extension.

### Sample JSON shape (policy fields only)

```json
{
  "blocked_apps": ["com.example.blocked"],
  "app_policies": [
    { "package_name": "com.whatsapp", "policy_status": "approved", "daily_limit_minutes": null },
    { "package_name": "com.example.blocked", "policy_status": "blocked", "daily_limit_minutes": null }
  ]
}
```

### What stays unchanged
- `blocked_apps` array remains for backward compatibility
- All other fields (schedules, bonus time, shabbat, screen time limits) untouched

### Files
- 1 new Supabase migration redefining `get_device_settings`

