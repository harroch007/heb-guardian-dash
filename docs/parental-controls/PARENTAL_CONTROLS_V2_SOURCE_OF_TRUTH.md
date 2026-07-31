# Kippy Parental Controls V2 — Source of Truth

> End-to-end ownership note (2026-07-31): this document defines the accepted
> guardian PWA product surface. The canonical V2 backend, Android integration
> order and release gate are defined in
> `C:\tmp\KippySafetyCore-v2\docs\kippy-v2-end-to-end-integration.md`.
> The active guardian routes now use the typed V2 client and reviewed V2
> contracts. Legacy V1 pages remain in the repository as donor code only and
> are not imported by the active guardian navigation.

Status: implementation baseline for the parent PWA
Scope owner: parent-facing parental controls only
Last updated: 2026-07-31

## Product boundary

Kippy has two product surfaces:

- The child device runs the native Android app. It reports device state and
  enforces approved policies. After setup it exposes no child-initiated
  actions, including requests for additional screen time.
- The parent uses the web/PWA. It configures protection, reviews device state,
  and sends explicit commands to the child device.

Hard rule: additional screen time can only be granted proactively by a
guardian from the parent PWA. The child app never asks for, approves or
negotiates additional time.

WhatsApp safety analysis keeps its separate Android capture, local-buffer and
expert-policy contracts. The parent-facing confirmed-incident feed is now
connected through the guardian-safe V2 projection; it never reads raw buffers
or encrypted incident payloads.

## Active V2 scope

Every child has one parent-facing Protection Center containing:

- Device connection, battery and last-report state.
- Screen-time usage, daily limit and parent-granted time.
- Installed apps, approval/block decisions and blocked attempts.
- Schedules, including existing Shabbat scheduling support.
- Current/last location, geofences, locate-now and ring-device actions.
- Lost mode.
- Device health and reported permission problems.

The parent home and family screens are summaries. Detailed control belongs in
`/child-v2/:childId`.

## Explicitly excluded from the active product

The following legacy product areas are not part of parental controls V2:

- Child chores and task approvals.
- Reward bank and task-earned time.
- Streaks and competition between children.
- Internal child/parent chat and chat invitations.
- Child-initiated extra-time requests.

Old routes redirect to `/home-v2`. Legacy source and database tables are not
dropped in this phase; they are isolated for audit and can be removed in a
separate destructive cleanup after production data has been reviewed.

## Settings flow

Parent feature code writes parental-control settings through
`src/lib/parental-controls/settingsService.ts`. This keeps the durable write and
the device refresh request behind one boundary.

The parent PWA writes the durable policy first:

- `v2_parental_settings` for daily screen-time limits, lost mode and geofence
  preferences.
- `v2_parental_bonus_grants` for parent-granted time.
- `v2_parental_app_policies` for app approval/block decisions.
- `v2_parental_schedules` for schedules.
- `v2_parental_geofences` for places and arrival/exit policy.

After a successful write, the PWA requests `REFRESH_SETTINGS` for every device
paired with that child. The Android app remains responsible for fetching and
enforcing the durable policy. A command is a wake-up/sync signal, not the source
of truth for the setting itself.

## Device command V2 contract

Parent feature code must use
`src/lib/parental-controls/commandService.ts`. It must not insert directly into
`device_commands`.

Allowed parent commands:

- `REPORT_HEARTBEAT`
- `LOCATE_NOW`
- `RING_DEVICE`
- `REFRESH_SETTINGS`

Known lifecycle states:

- `PENDING`
- `ACKNOWLEDGED`
- `COMPLETED`
- `FAILED`
- `EXPIRED`
- `TIMED_OUT`

The V2 database function:

- Requires an authenticated user.
- Verifies that the caller is an authorized parent or co-parent for the device.
- Rejects command types outside the allowlist.
- Adds a bounded expiry time.
- Records the requesting parent.
- Supports a caller-stable request key so retries are idempotent.
- Stores an optional JSON payload for future command versions.
- Is the only parent-facing insert path; the legacy direct-insert policy is
  removed when the migration is applied.

The active command service has no legacy insert fallback. It uses only
`v2_request_parental_command` and reads only `v2_device_commands`.

The original unrestricted command-update policy is also removed. Existing
device-scoped JWT and temporary paired-device compatibility policies are left
unchanged in this phase so the Android client is not silently disconnected.

The canonical backend migrations live under
`C:\tmp\KippySafetyCore-v2\supabase\migrations`. The similarly named local PWA
migration is retained as donor history and is not the V2 deployment source.

## Guardian settings, Push and confirmed alerts

Active canonical routes:

- `/settings-v2` -> `src/pages/SettingsV2Canonical.tsx`
- `/alerts-v2` -> `src/pages/AlertsV2Canonical.tsx`
- `/family-v2` -> `src/pages/FamilyV2Canonical.tsx`

Direct legacy report, summary, notification-settings, checkout, invitation and
admin URLs redirect to their safe V2 destination. Their source files are kept
as donor code and are not imported into the active route graph.

The settings route uses `v2_guardian_profiles`,
`v2_guardian_memberships`, `v2_update_guardian_profile` and the authenticated
V2 Web Push endpoint RPCs. It does not read `parents`, `family_members` or
`push_subscriptions`.

The alert route reads only confirmed `v2_safety_incidents` plus their
`v2_incident_analysis` parent-safe projection. Per-guardian workflow state is
stored separately in `v2_guardian_incident_states`; it contains only
`new/saved/acknowledged` state and timestamps, never message text.

`V2_GUARDIAN_ALERTS_ENABLED` exposes the V2 alert feed independently of the
legacy premium flag. This prevents old subscription and upgrade assumptions
from re-entering the V2 product.

The verified production bundle contains the V2 Staging project reference and
contains no V1 project reference, legacy admin/waitlist RPC or `parents` table
dependency.

## V1 isolation rule

Legacy V1 pages may remain as donor/reference code, but they are not active
routes and must not be imported into a new V2 flow. New parental-control work
uses:

- V2 routes and navigation.
- The Protection Center as the per-child entry point.
- The parental-control settings service for durable policy writes.
- The parental-control command service for device commands.
- Durable policy tables as the source of truth.

Any future removal of legacy tables, functions, pages or Edge Functions is a
separate migration with a production-data audit and rollback plan.
