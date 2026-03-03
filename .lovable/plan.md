

## Plan: Create `report_device_heartbeat` endpoint

### What we'll create (single migration)

1. **Table `device_heartbeats_raw`**
   - `id bigserial PK`, `child_id uuid`, `device_id text NOT NULL`, `device jsonb NOT NULL`, `permissions jsonb NOT NULL`, `reported_at timestamptz NOT NULL DEFAULT now()`
   - RLS enabled with permissive INSERT (WITH CHECK true) and permissive SELECT for admins

2. **Function `report_device_heartbeat`** — exact Android signature:
   ```
   (p_child_id uuid, p_device jsonb, p_device_id text, p_permissions jsonb, p_timestamp timestamptz)
   ```
   - `LANGUAGE sql`, `SECURITY DEFINER`, returns `void`
   - Inserts into `device_heartbeats_raw`

3. **`NOTIFY pgrst, 'reload schema'`** to ensure PostgREST picks up the new function immediately

4. **Verification query** (read-only) on `device_heartbeats_raw` to confirm table exists and is empty, ready for Android heartbeats

No existing tables or functions are modified.

