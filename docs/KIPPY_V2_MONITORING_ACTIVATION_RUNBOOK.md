# Kippy V2 monitoring push activation and rollback runbook

## Document control

- Version: 1.0
- Date: 2026-08-31
- Status: REVIEW DRAFT — not activation approval
- Applies to source baseline: `5adf6c9d14ea66cffa56f9ec7588a7f9ca98794a`
- Readiness migration: `20260831230000_v2_monitoring_push_activation_readiness.sql`
- Staging project: `gscclrgcmvtbyquveoze`

This runbook contains secret identifiers only. Never paste a token, Vault value,
VAPID private JWK, or service-role key into this file, chat, shell history,
screenshots, logs, SQL output, or evidence bundles.

## Scope and safety boundary

The monitoring delivery lane remains separate from confirmed safety-incident
delivery. This runbook never modifies `v2_alert_deliveries`,
`v2-deliver-parent-push`, or `check-device-health`.

Applying the readiness patch is not activation. Activation requires a new,
explicit approval covering each mutation below. The database migration itself
must not create secrets, Vault values, capability rows, endpoints, feature
flags, or cron jobs.

## Required identities and configuration names

Edge runtime configuration:

- `KIPPY_MONITORING_PUSH_DELIVERY_ENABLED`
- `KIPPY_MONITORING_PUSH_WORKER_TRIGGER_TOKEN`
- `KIPPY_MONITORING_PUSH_DB_CAPABILITY_TOKEN`
- `KIPPY_WEB_PUSH_VAPID_KEYS_JWK`
- `KIPPY_WEB_PUSH_PUBLIC_KEY`
- `KIPPY_WEB_PUSH_CONTACT`

Vault entries read by the monitoring dispatcher, and no others:

- `kippy_v2_monitoring_push_worker_endpoint`
- `kippy_v2_monitoring_push_worker_trigger_token`

Database objects:

- `v2_monitoring_push_worker_capabilities`
- `v2_monitoring_push_activation_epochs`
- `v2_prepare_monitoring_push_activation_internal()`
- `v2_dispatch_monitoring_push_worker_internal(integer)`

The trigger token in Edge configuration and the trigger token stored under the
Vault identifier must be the same secret, transferred through an approved
secret manager without displaying it. The database capability token and trigger
token must be independently generated values. Store only the capability token's
SHA-256 digest in PostgreSQL.

`KIPPY_WEB_PUSH_VAPID_KEYS_JWK` is the cryptographic source of truth. The public
key setting must equal the application-server key exported from that exact JWK.
`v2-get-push-config` verifies the equality at runtime and returns only the public
key. It returns 503 on missing, malformed, or mismatched VAPID configuration.
The frontend has no hardcoded or build-time fallback.

The VAPID configuration is shared with confirmed-incident Web Push. Do not
rotate or remove an already approved shared keypair as part of monitoring-only
rollback. Any shared-key rotation needs its own safety-incident regression gate.

## Gate A — readiness deployment only

Required evidence before requesting deployment approval:

1. Work from the independently reviewed commit, not an uncommitted or stale
   tree.
2. Linked ledger: 61 matched migrations, zero remote-only, and only
   `20260831230000` local-only.
3. Linked dry-run: exactly `20260831230000`, with no repair operation.
4. Full disposable 62-migration history and all monitoring SQL/Deno contracts
   pass.
5. The migration source contains no `cron.schedule` call and no inserts into
   capability, Vault, or endpoint tables.
6. Record pre-deployment counts for monitoring cron jobs, active capabilities,
   Vault-name presence, leases, due rows, and endpoint attempts. Read names and
   counts only; never select decrypted Vault values or token hashes.

After separately approved readiness deployment, deploy only the reviewed
`v2-deliver-monitoring-push` and `v2-get-push-config` bundles. Keep
`KIPPY_MONITORING_PUSH_DELIVERY_ENABLED` false and leave monitoring capability,
Vault, endpoint, and cron state absent. Re-run the dormant fail-closed checks and
stop.

## Gate B — controlled activation preparation

This gate requires a new approval and one explicitly approved real staging test
guardian/browser plus a real Kippy Android test device. Synthetic database rows
or fabricated provider responses are not activation evidence.

Perform these steps in order, recording timestamps and counts but no secret
material:

1. Confirm the readiness migration and exact reviewed function versions are
   deployed. Confirm the feature flag is false and no monitoring cron exists.
2. Confirm there are no active monitoring leases and explain all queued/failed
   rows. Stop on unexplained drift.
3. Through the approved secret manager, configure the shared VAPID JWK, its
   matching public key, and contact. Verify an authenticated guardian call to
   `v2-get-push-config` returns contract version 1 and the expected public-key
   fingerprint; never log the JWK.
4. Register only the approved real staging guardian/browser endpoint. Confirm
   its guardian, family, permission, and active status without returning endpoint
   key material in evidence.
5. Generate independent trigger and capability tokens through the approved
   secret process. Configure the three dedicated Edge names. Store only the
   capability digest in the capability table and store only the exact endpoint
   and trigger-token entries under the two approved Vault names.
6. Reconfirm that capability validation still returns false because
   `enablement_prepared_at` is null. This proves credentials alone cannot open
   the lane.
7. At the approved activation moment, call the one-time preparation function as
   database owner. It records the server clock only after acquiring the outbox
   lock; callers cannot supply a stale cutoff. Capture its returned aggregate
   counts and independently verify every pre-cutoff queued/failed row is retained
   as `suppressed` with the expected reason. Stop on any count mismatch.
8. Confirm the activation epoch now contains the immutable dormant cutoff, the
   approved later effective cutoff, and a non-null preparation timestamp.

The preparation operation is irreversible by design. Do not call it early and
do not retry it after success.

## Gate C — one-device runtime proof

This gate requires another explicit approval because it enables and invokes
external delivery.

1. Limit active endpoint and capability scope to the approved staging guardian.
2. Set `KIPPY_MONITORING_PUSH_DELIVERY_ENABLED` true.
3. Invoke one bounded owner-only dispatch for one approved real-device
   interruption. Do not schedule cron yet.
4. Verify exactly one normal provider-accepted interruption attempt, privacy-safe
   payload fields, bounded TTL, completed lease, and no safety-incident delivery
   mutation.
5. Drive the same real device through restoration and verify the restoration is
   attempted only after the accepted disruption and at most once in the normal
   completion path.
6. Exercise one approved transient retry and one 404/410 endpoint invalidation
   only if the test plan explicitly authorizes those external effects.
7. Set the feature flag false immediately after the controlled proof and review
   counts, logs, duplicate risk, and payload privacy before requesting cron
   approval.

## Gate D — recurring dispatch

Only after Gate C evidence is independently approved may the database owner
create one job named `kippy-v2-monitoring-push` that calls the bounded dispatcher.
The cron change is an operational action, not a migration. Verify its owner,
schedule, command, and uniqueness, then re-enable the feature flag under the
same approval window.

Stop and roll back if the ledger or source version drifts, VAPID verification
returns 503, any credential is exposed, the preparation counts disagree, an
unapproved endpoint is active, a pre-cutoff row becomes claimable, more requests
than the bound are queued, a safety-incident table changes, or any contract fails.

## Rollback

Rollback prioritizes stopping external delivery and does not delete audit data:

1. Set `KIPPY_MONITORING_PUSH_DELIVERY_ENABLED` false.
2. Unschedule only `kippy-v2-monitoring-push` and verify no command still calls
   `v2_dispatch_monitoring_push_worker_internal`.
3. Revoke the active monitoring capability row and retain its audit history.
4. Remove only the two monitoring Vault entries listed in this runbook.
5. Remove the three dedicated monitoring Edge runtime names. Do not remove the
   shared VAPID configuration during a monitoring-only rollback.
6. Allow any existing lease to expire; do not requeue, delete, or unsuppress
   historical rows. Preserve endpoint-attempt and activation audit evidence.
7. Confirm the worker returns 503 while disabled, the dispatcher returns zero,
   and endpoint-attempt counts stop changing.

The additive migration, cutoff columns, functions, audit events, and suppressed
rows remain in place. Do not run a down migration. A later reactivation after a
rollback could otherwise replay rows accumulated during the disabled interval;
it therefore requires a new reviewed forward migration or owner-only cutoff
operation designed specifically to suppress that later gap. The one-time initial
preparation function must not be reset or reused.

## Evidence record

For every gate, record the reviewed commit, operator, approval reference, UTC
start/end, migration/function versions, before/after counts, HTTP status classes,
and PASS/FAIL decision. Redact endpoint URLs and identifiers where practical.
Record only fingerprints for public keys and never record tokens, private keys,
Vault plaintext, subscription authentication material, or service-role keys.
