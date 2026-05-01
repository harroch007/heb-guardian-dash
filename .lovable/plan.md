# Plan: Seed Mock User "Dani" for Chat Testing

## Goal
Create a fully functional mock peer ("דני") that Yariv (`c30061e9-ed82-48fc-9a5f-2bd94d8bbdd5`) can chat with via the internal child-to-child chat system. The mock must satisfy real RLS, FK, and JWT constraints so the Android client behaves identically to a real friendship.

## Confirmed Targets
- **Yariv's child_id** (testing child): `c30061e9-ed82-48fc-9a5f-2bd94d8bbdd5`
- **Yariv's parent_id**: `fd0a1cc1-e838-4f15-951c-873423a81f47`
- **Friendship UUID** (fixed, easy to remember): `00000000-0000-0000-0000-000000001234`
- **Dani's device_id** (fixed): `dani-mock-device-0001`

## Why an Edge Function (not raw SQL)
`parents.id` references `auth.users(id)`. We cannot insert into `auth.users` from SQL safely — it requires `supabase.auth.admin.createUser()`. So the seed must run inside an edge function with the service role key.

## Implementation

### 1. New edge function: `seed-mock-peer`
Path: `supabase/functions/seed-mock-peer/index.ts`

Behavior (idempotent — safe to re-run):
1. **Auth gate**: require caller JWT, verify caller is admin via `is_admin()` RPC. Reject otherwise.
2. **Create / fetch auth user** for `dani.parent@kippy.mock`:
   - `auth.admin.listUsers` filter by email; if missing, `auth.admin.createUser({ email, password: random, email_confirm: true })`.
3. **Upsert `parents` row** with `id = <dani auth user id>`, `full_name = 'אמא של דני'`, `email = 'dani.parent@kippy.mock'`.
4. **Upsert `children` row** for Dani:
   - `parent_id` = Dani's parent id
   - `name = 'דני'`, `phone_number = '+972500000001'`, `gender = 'male'`, `date_of_birth = '2012-06-01'`, `kippy_tag = 'dani#1234'`
   - Look up by `(parent_id, name)` first to avoid duplicates; capture `dani_child_id`.
5. **Upsert `devices` row**:
   - `device_id = 'dani-mock-device-0001'`, `child_id = dani_child_id`, `device_model = 'MockDevice'`, `device_manufacturer = 'Kippy'`, `last_seen = now()`, `first_seen_at = now()`.
6. **Upsert `friendships` row** with fixed UUID `00000000-0000-0000-0000-000000001234`:
   - `requester_id = c30061e9-... (Yariv)`, `receiver_id = dani_child_id`, `status = 'accepted'`, `responded_at = now()`.
   - On conflict on `id` → update status to accepted.
7. Return JSON `{ dani_parent_id, dani_child_id, dani_device_id, friendship_id }`.

Config: standard `verify_jwt = false` (we validate in code via `getClaims`). Uses `SUPABASE_SERVICE_ROLE_KEY` for admin operations.

### 2. Invocation
After deploy, I'll call it once via `supabase--curl_edge_functions` (your browser session JWT will be attached automatically since you're logged in as admin) and return the IDs to you.

### 3. Verification queries
- `SELECT * FROM friendships WHERE id = '00000000-0000-0000-0000-000000001234';`
- `SELECT id, name FROM children WHERE id = <dani_child_id>;`
- Confirm Yariv's chat list now shows Dani.

## Notes / Caveats
- **Chat from Dani's side won't work** without a real device JWT for `dani-mock-device-0001`. That's fine for testing Yariv's send/receive UI; if you later want bidirectional, we can add a second function that mints a device JWT for the mock device.
- The fixed friendship UUID `00000000-0000-0000-0000-000000001234` lets the Android app hardcode it if needed.
- Function is idempotent — re-running won't duplicate rows.
- No data deleted; only inserts/updates.

## Deliverables
After execution you'll receive:
1. `dani_child_id` (UUID)
2. `friendship_id` = `00000000-0000-0000-0000-000000001234`
3. `dani_device_id` = `dani-mock-device-0001`
