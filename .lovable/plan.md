

## Analysis: Queue Health Card Always Shows 0

### Root Cause

The `alert_events_queue` table has conflicting RLS policies. All policies are **Restrictive** (not Permissive), and PostgreSQL requires ALL restrictive policies to pass for access.

Current policies for SELECT:
- "Admins can view queue" - `USING (is_admin())` -- Restrictive
- "no_select_for_public_roles" - `USING (false)` -- Restrictive

Since both are restrictive, even admins are blocked by the `USING (false)` policy. Result: the query always returns empty, so `queuePending` and `queueFailed` are always 0.

### Fix

Drop the conflicting `no_*_for_public_roles` policies on `alert_events_queue` and replace them with proper Permissive policies:

1. **Database migration** to fix RLS:
   - Drop `no_select_for_public_roles`, `no_modify_for_public_roles`, `no_update_for_public_roles`, `no_delete_for_public_roles`
   - Change "Admins can view queue" from Restrictive to Permissive (drop and recreate)

This is a single SQL migration -- no code changes needed. The UI logic is already correct; it just never receives data due to the RLS conflict.

### Technical Details

```text
Current (broken):
  Restrictive "Admins can view"  AND  Restrictive "false"
  = is_admin() AND false = always false

Fixed:
  Permissive "Admins can view" (is_admin())
  = is_admin() = true for admins
```

No other tables are affected. The `alert_events_queue` INSERT/UPDATE/DELETE should remain denied for regular users (only the service role and DB functions like `enqueue_ai_analyze_on_alert_insert` and `claim_alert_events` operate on this table with SECURITY DEFINER).

