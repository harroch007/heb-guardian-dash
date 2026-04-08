
# Stage 7 — Device-Scoped JWT Secure Contract

## Phase 1: COMPLETE ✅

Schema: `devices.auth_user_id UUID` column added with FK to `auth.users`, index created.

Bootstrap: `bootstrap-device-auth` edge function deployed — calls `pair_device` RPC then creates/reuses a Supabase Auth user per device with `app_metadata: {device_id, child_id, role: "device"}`.

No breaking changes. Legacy anon path untouched.

## Phase 2: COMPLETE ✅

Android client now uses device-scoped JWT auth session (established via bootstrap).

## Phase 3: COMPLETE ✅

`device_commands` hardened: dropped legacy anon `USING (true)` SELECT/UPDATE policies, replaced with JWT-scoped `authenticated` policies using `get_device_id_from_jwt()` helper. Devices can now only read/update their own command rows. Parent/admin INSERT policies unchanged.

## Phase 4A: COMPLETE ✅

`get_device_settings` hardened with fail-closed device-only authorization: (1) `EXECUTE` revoked from `PUBLIC` and `anon`, granted only to `authenticated`. (2) Three-step fail-closed gate inside function: `auth.role()` must be `authenticated`, `app_metadata.role` must be `device`, and JWT `device_id` must match `p_device_id`. Generic authenticated callers (parents, admins) are explicitly denied with `UNAUTHORIZED`. service_role callers are denied through the `auth.role()` gate. No parent/co-parent access path exists.

## Phase 4B: COMPLETE ✅

`update_device_status` hardened with fail-closed device-only authorization and overload consolidation: (1) 6-param authoritative version now enforces three-step gate: `auth.role()` must be `authenticated`, `app_metadata.role` must be `device`, JWT `device_id` must match `p_device_id`. (2) Insert-on-missing fallback removed — raises `DEVICE_NOT_FOUND_OR_NOT_PAIRED` if device row doesn't exist. (3) Legacy 4-param overload converted to thin compatibility shim delegating to authoritative 6-param path. (4) `EXECUTE` revoked from `PUBLIC` and `anon` on both overloads, granted only to `authenticated`.

## Phase 4C: COMPLETE ✅

`create_alert` hardened with fail-closed device-only authorization: (1) Three-step gate added: `auth.role()` must be `authenticated`, `app_metadata.role` must be `device`, JWT `device_id` must match `p_device_id`. (2) `EXECUTE` revoked from `PUBLIC` and `anon`, granted only to `authenticated`. (3) Function signature, alert payload shape, and ON CONFLICT dedup logic unchanged. (4) Devices can only create alerts for their own `device_id`.

## Phase 4D+: PENDING (follow-up)

Harden remaining Android-facing RPCs: `report_device_heartbeat`, `report_installed_apps`, and INSERT policies on app_usage/blocked_app_attempts.
