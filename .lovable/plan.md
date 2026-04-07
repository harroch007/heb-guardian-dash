
# Stage 7 — Device-Scoped JWT Secure Contract

## Phase 1: COMPLETE ✅

Schema: `devices.auth_user_id UUID` column added with FK to `auth.users`, index created.

Bootstrap: `bootstrap-device-auth` edge function deployed — calls `pair_device` RPC then creates/reuses a Supabase Auth user per device with `app_metadata: {device_id, child_id, role: "device"}`.

No breaking changes. Legacy anon path untouched.

## Phase 2: PENDING

Add JWT-aware RLS policies on `device_commands` (additive). Migrate RPCs to extract device_id from JWT claims.

## Phase 3: PENDING

Drop legacy anon `qual: true` policies after Android rollout confirmation.

## Phase 4: PENDING (follow-up)

Harden INSERT policies on alerts/app_usage/blocked_app_attempts.
