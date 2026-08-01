# Control Tower Web ↔ CT-R0 Compatibility Contract

## Status

The current Control Tower feature is a safe, development-only UI fixture. It is
not wire-compatible with the CT-R0 SQL/RPC contract and must not be described as
a production backend integration.

Production behavior remains fail-closed:

- Fixture code loads only when `!import.meta.env.PROD` and
  `VITE_CONTROL_TOWER_FIXTURES === "true"`.
- Without a remote repository, the feature returns
  `STAFF_BACKEND_NOT_CONFIGURED` and renders no customer data.
- The production bundle test proves that fixture identifiers and the fixture
  repository are absent from built assets.

## Canonical CT-R0 boundary

CT-R0 is read-only. Its canonical permission keys include:

- `control.session.read`
- `fixture.read`
- `inbox.read`
- `case.read.assigned`
- `case.read.all`
- `conversation.read`
- `message.read.redacted`
- `service360.read.masked`
- `device.install.read`
- `device.health.read`
- `device.command_lifecycle.read`
- `safety.parent_safe.read`
- `audit.read`
- `iam.read`

Only `conversation.read` currently matches the TypeScript fixture vocabulary
exactly. A remote adapter must preserve the SQL names and may map them into UI
capabilities only through an explicit, tested decoder.

All authenticated CT-R0 reads require an AAL2 staff principal. The web guard's
AAL2 intent is correct, but lower-case SQL values and backend error responses
still require decoding.

## Unsupported command boundary

CT-R0 exposes no supported RPC for:

- public or account-specific replies;
- internal notes;
- takeover or lease transitions;
- case assignment;
- device refresh/heartbeat requests;
- action approval or execution transitions.

The fixture may simulate these flows for UI development. A remote CT-R0 session
must hide or disable them and return `NOT_SUPPORTED`; it must never silently
convert a fixture mutation into a production promise.

The command surface belongs in a future, separately versioned contract after
authorization, idempotency, approval, audit, rate-limit, and rollback semantics
are approved.

## Required remote-read architecture

1. Split the repository boundary into a CT-R0 read repository and a future
   command repository.
2. Add a `RemoteReadOnlyControlTowerRepository` that calls only canonical RPCs.
3. Make `source_mode` explicit (`fixture` or `staging`). Never infer backend
   fixture access from a generic remote mode.
4. Decode the RPC wrapper, lower-case enums, UUIDs, cursor pair, AAL2 failures,
   availability, freshness, sensitivity, and redaction without weakening server
   policy.
5. Assemble a read-only workspace from the separate session, inbox,
   conversation, case, message, timeline, Service360, and action-lifecycle RPCs.
6. Render missing fields as unavailable/not collected. Do not synthesize values,
   labels, versions, entitlement, Android build data, repair guidance, queue
   counts, unread counts, or action availability.
7. Treat `list_case_actions` as lifecycle history, not an allowed-action
   catalogue.
8. Keep the TypeScript fixture labelled UI-unit-only until it is replaced by a
   decoder over the SQL fixture contract and UUIDs.

## Known CT-R0 projection gaps

The current UI expects data not returned by CT-R0, including:

- queue totals and a single opaque next cursor;
- unread count, message preview, delivery summary, identity match, and full SLA
  clock;
- case owner label and selected case resolution fields;
- sender/attachment/reply/template message metadata;
- rich device capability reasons, policy impact, and repair guidance;
- Android OS/build, detailed install progress, entitlement, parental-sync
  projection, and detailed push health;
- a normalized operational timeline and an allowed-action catalogue.

These are CT-R1 product/contract decisions. They must not be filled with fixture
values in a remote session.

## Integration acceptance criteria

- Canonical permission and enum decoders have table-driven tests.
- `source_mode` is required and fixture mode additionally proves `fixture.read`.
- AAL1, denied, expired, malformed, and redacted responses fail closed.
- The adapter performs no write RPC and exposes no enabled command control.
- Server redaction and availability states survive mapping unchanged.
- Remote contract fixtures use backend UUIDs and RPC shapes.
- Production build excludes the synthetic TypeScript dataset.
- Lint, targeted typecheck, production build, and production fail-closed
  Playwright pass before the adapter is enabled.

## Current verification snapshot

- Scoped ESLint: passed.
- Targeted TypeScript check with `vite/client`: passed.
- Production Vite build: passed.
- Production fail-closed Playwright: 2 passed.
- Development fixture Playwright: timed out without a test result and remains an
  open verification item.

