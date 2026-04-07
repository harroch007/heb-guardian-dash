
# Stage 7 — Device-Scoped JWT Secure Contract

## Phase 1: COMPLETE ✅

Schema: `devices.auth_user_id UUID` column added with FK to `auth.users`, index created.

Bootstrap: `bootstrap-device-auth` edge function deployed — calls `pair_device` RPC then creates/reuses a Supabase Auth user per device with `app_metadata: {device_id, child_id, role: "device"}`.

No breaking changes. Legacy anon path untouched.

## Phase 2: COMPLETE ✅

Android client now uses device-scoped JWT auth session (established via bootstrap).

## Phase 3: COMPLETE ✅

`device_commands` hardened: dropped legacy anon `USING (true)` SELECT/UPDATE policies, replaced with JWT-scoped `authenticated` policies using `get_device_id_from_jwt()` helper. Devices can now only read/update their own command rows. Parent/admin INSERT policies unchanged.

## Phase 4: PENDING (follow-up)

Harden INSERT policies on alerts/app_usage/blocked_app_attempts.
