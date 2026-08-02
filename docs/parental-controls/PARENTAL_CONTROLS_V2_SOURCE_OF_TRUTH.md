# Kippy Guardian PWA V2 — Source of Truth

Status: guardian-surface contract under the unified-product decision
Scope owner: parent-facing PWA
Last updated: 2026-08-01

## Unified-product override

The founder approved the unified Kippy V2 product on 2026-08-01. The binding
cross-surface contract is
[`KIPPY_UNIFIED_PRODUCT_V2_SOURCE_OF_TRUTH_HE.md`](../KIPPY_UNIFIED_PRODUCT_V2_SOURCE_OF_TRUTH_HE.md).
The current release must contain both parental controls and WhatsApp safety.
Any WhatsApp-only limitation below is superseded by that decision.

## Product boundary

Kippy V2 currently has two product surfaces:

- The Android app on the child device is a transparent WhatsApp safety
  monitoring agent. After setup it displays only protection status and exposes
  no child actions, content or parent data.
- The guardian uses the web/PWA to add children, connect devices, see whether
  monitoring is active and review confirmed parent-safe alerts.

The current release includes screen time, app policy/blocking, schedules,
location/geofences, locate/ring/lost mode and device health alongside WhatsApp
safety. Existing parental-control code is donor input until it is reconnected
to reviewed V2 contracts and passes the unified release gate.

## Active parent experience

The active guardian routes are:

- `/home-v2` — family monitoring summary and confirmed-alert count.
- `/family-v2` — one separate monitoring card for every child/device.
- `/child-v2/:childId` — monitoring state, last report, battery and the four
  required protection capabilities.
- `/alerts-v2` — confirmed parent-safe incidents only.
- `/settings-v2` — guardian profile and Web Push settings.
- `/install/:activationToken` — public child-device install handoff.

Each child card may show only:

- monitoring state (`healthy`, `late`, `interrupted`, setup required or
  awaiting first report);
- last device report and battery level;
- Accessibility, Notification Listener, app-notification and battery-exemption
  status;
- count of confirmed alerts that the guardian has not saved or acknowledged;
- a QR action for first connection or reconnection.

The PWA never reads or displays the local WhatsApp FIFO, routine child messages
or encrypted expert context.

## Active Android capabilities

The current release requests exactly four capabilities during setup:

1. app notifications for the visible ongoing protection notification;
2. battery-optimization exemption for continuous background operation;
3. Accessibility for child-visible WhatsApp capture;
4. Notification Listener as a complementary intake and reconciliation signal.

Location, Usage Access, package inventory, app blocking, overlays, geofences,
ring, lost mode and screen-time enforcement are not active and are not required
for `product_ready`.

## Explicitly excluded scope

The following remain outside the current product:

- child-initiated extra-time requests;
- chores, rewards, reward banks, streaks and competition;
- internal parent/child chat and invitations;
- additional monitored social platforms.

Active parental controls may be shown only after their V2 contract and Android
runtime are connected. Until then, each incomplete control must fail closed
and must not claim successful enforcement.

## WhatsApp safety and parent alerts

WhatsApp capture, local per-conversation FIFO buffers, local filters and expert
analysis are governed by the Android V2 safety contracts. The PWA receives only
the guardian-safe confirmed-incident projection:

- `v2_safety_incidents` for confirmed/alerted event identity and status;
- `v2_incident_analysis` for parent-safe explanation and recommendation;
- `v2_guardian_incident_states` for `new`, `saved` and `acknowledged` workflow.

Raw routine WhatsApp content and local buffers are never a parent-PWA read
model.

## V1 and donor isolation

Legacy pages and services may remain in source until a separately approved
destructive cleanup. They must remain unreachable from active navigation and
must not be bundled into active Android execution paths. Old URLs redirect to a
safe V2 destination.

Reactivation of parental controls is part of the approved unified-product
phase. It still requires updated Play disclosures, permission review and
end-to-end tests; dormant code or existing tables alone never count as an
active capability.
