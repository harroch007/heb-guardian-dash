
# Stage 7A — Corrected Design-Lock: Device-Scoped JWT Model

Status: READY FOR IMPLEMENTATION

---

## 1. Why the Previous Session-Variable Model Is Insufficient for Realtime

Supabase Realtime does NOT execute arbitrary RPCs before establishing a channel subscription. When Android subscribes to `device_commands` changes via Realtime, it provides a JWT in the connection handshake — Realtime evaluates RLS policies using the claims embedded in that JWT. There is no opportunity to call `authenticate_device` first to set `current_setting('app.device_id')` because:

1. Realtime connections use a **persistent WebSocket** authenticated once at connect time via JWT
2. `SET LOCAL` / `current_setting()` are per-transaction — they do not persist across the Realtime connection's internal transactions
3. There is no Realtime hook to run a custom RPC before policy evaluation

Therefore, **any RLS policy that depends on a session variable set by a prior RPC call will always evaluate to NULL/false in Realtime**, making `device_commands` invisible to the device. The only reliable scoping mechanism for Realtime RLS is **JWT claims**.

---

## 2. Corrected Recommended Secure Contract Model

### Model: Device-Scoped Supabase Auth User with Custom JWT Claim

#### Bootstrap Path
1. Android calls `pair_device(p_device_id, p_pairing_code)` as today (anon RPC, SECURITY DEFINER)
2. `pair_device` is extended to:
   - Create a Supabase Auth user for this device (via `supabase.auth.admin.createUser`) with a deterministic email like `device-{device_id}@devices.internal` and a generated password
   - Store the device's auth `user_id` in a new `devices.auth_user_id` column
   - Set `raw_app_meta_data` on the user: `{"device_id": "<device_id>", "child_id": "<child_id>", "role": "device"}`
   - Return `{ success, child_id, child_name, device_email, device_password }` to Android
3. Android stores these credentials securely and uses `supabase.auth.signInWithPassword()` to obtain a JWT

#### Token/JWT Path
- Android authenticates as a real Supabase Auth user
- The JWT contains standard claims (`sub`, `role: "authenticated"`) plus custom `app_metadata` claims: `device_id`, `child_id`, `role: "device"`
- All subsequent API calls (PostgREST, Realtime, RPCs) carry this JWT automatically
- Token refresh works via standard Supabase `autoRefreshToken`

#### Claim(s) Required
```
auth.jwt() ->> 'app_metadata' -> 'device_id'   -- scopes to this device
auth.jwt() ->> 'app_metadata' -> 'child_id'     -- scopes to this child
auth.jwt() ->> 'app_metadata' -> 'role'          -- = 'device'
```

#### RLS for `device_commands` (replaces `qual: true`)
```sql
-- SELECT: device can only read its own commands
CREATE POLICY "Devices read own commands via JWT"
ON device_commands FOR SELECT TO authenticated
USING (
  device_id = (auth.jwt() -> 'app_metadata' ->> 'device_id')
);

-- UPDATE: device can only update its own commands
CREATE POLICY "Devices update own commands via JWT"
ON device_commands FOR UPDATE TO authenticated
USING (
  device_id = (auth.jwt() -> 'app_metadata' ->> 'device_id')
);
```

#### SECURITY DEFINER RPCs — Migration Path
All Android-facing RPCs gain an optional `p_device_token` parameter during grace period, but the **primary auth path** shifts to:
- Android calls RPCs as an authenticated device user
- RPCs extract `device_id` from `auth.jwt() -> 'app_metadata' ->> 'device_id'` internally
- During grace period: if JWT claim is present, use it; if not, fall back to `p_device_id` parameter (legacy)
- After grace period: reject calls without valid device JWT claim

#### Backend Surfaces Affected
| Surface | Current Auth | Target Auth |
|---------|-------------|-------------|
| `device_commands` SELECT | anon, `qual: true` | authenticated, JWT `device_id` claim |
| `device_commands` UPDATE | anon, `qual: true` | authenticated, JWT `device_id` claim |
| `get_device_settings` | anon RPC, bare `p_device_id` | authenticated RPC, JWT claim validated |
| `update_device_status` | anon RPC, bare `p_device_id` | authenticated RPC, JWT claim validated |
| `report_device_heartbeat` | anon RPC, bare `p_device_id` | authenticated RPC, JWT claim validated |
| `report_installed_apps` | anon RPC, bare `p_device_id` | authenticated RPC, JWT claim validated |
| `create_alert` | anon RPC, bare `p_device_id` | authenticated RPC, JWT claim validated |
| `pair_device` | anon RPC (bootstrap) | **remains anon** — this is the bootstrap entry point |

---

## 3. Corrected Migration Sequence

### Phase 1: Schema + Bootstrap (no breaking changes)
- Add `devices.auth_user_id UUID` column (nullable, references `auth.users`)
- Create edge function `create-device-user` that:
  - Receives `device_id` + `child_id`
  - Creates Supabase Auth user with `app_metadata: {device_id, child_id, role: "device"}`
  - Returns credentials
- Extend `pair_device` to call this edge function (or do it inline via `auth.admin` in a new edge function wrapper)
- Android update: after `pair_device`, sign in with returned credentials, store refresh token
- **Legacy path stays alive**: all existing anon policies and RPCs unchanged

### Phase 2: Add JWT-aware RLS policies (additive, non-breaking)
- Add new PERMISSIVE policies on `device_commands` scoped to `authenticated` role with JWT `device_id` claim
- Keep existing anon `qual: true` policies alive temporarily
- Android devices that have upgraded now use JWT path; old devices still work on anon path
- RPCs: add internal `device_id` extraction from JWT as preferred source, fall back to parameter

### Phase 3: Remove legacy anon policies (breaking for unupgraded devices)
- Drop `device_commands` anon SELECT/UPDATE `qual: true` policies
- RPCs: reject calls without valid device JWT claim
- **Prerequisite**: confirm all active Android devices have upgraded and are using JWT auth
- Monitoring: track `pair_device` calls and `devices.auth_user_id IS NULL` count to verify migration completeness

### Phase 4: Harden data-entry tables (follow-up)
- Tighten `alerts`, `app_usage`, `blocked_app_attempts` INSERT policies to require device JWT claim
- Token rotation mechanism

---

## 4. Release-Blocking Scope

### Must-fix NOW (blocks Stage 7 close):
- **Phase 1**: `devices.auth_user_id` column, device user creation logic, `pair_device` extension
- **Phase 2**: JWT-scoped RLS policies on `device_commands` (additive)
- **Phase 3**: Drop legacy anon policies (after Android rollout confirmation)

### Allowed follow-up (does NOT block release):
- Phase 4: Hardening INSERT policies on `alerts`, `app_usage`, `blocked_app_attempts`
- Token/credential rotation mechanism
- Revoking device auth users when a device is unpaired
- Rate limiting on device RPCs

---

## 5. Files / Live Objects Reviewed

### Live DB Queries Executed:
```
pg_proc: pair_device, get_device_settings, update_device_status,
         report_device_heartbeat, report_installed_apps, create_alert
         → all SECURITY DEFINER, all accept bare p_device_id

pg_policies WHERE tablename = 'device_commands':
  → "Devices can read their own commands"  SELECT anon qual=true
  → "Devices can update their own commands" UPDATE anon qual=true
  → "Parents can insert commands..."       INSERT public with_check=is_family_parent_for_device
  → "Parents can view commands..."         SELECT public qual=is_family_parent_for_device
  → "Admins can insert device commands"    INSERT authenticated with_check=is_admin()

information_schema.columns WHERE table_name='devices':
  → 11 columns, NO auth_user_id column exists yet

pg_get_functiondef(pair_device):
  → creates/upserts device row, returns success/child_id/child_name
  → does NOT create auth user or return credentials
```

---

## 6. Final Verdict

**READY FOR IMPLEMENTATION** — corrected secure contract model using device-scoped Supabase Auth JWT is now locked.

Key difference from previous lock: RLS scoping uses `auth.jwt() -> 'app_metadata' ->> 'device_id'` which works correctly for both PostgREST and Realtime, instead of `current_setting('app.device_id')` which fails for Realtime.
