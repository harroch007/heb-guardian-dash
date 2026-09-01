# Kippy V2 monitoring push activation and rollback runbook

## Document control

- Version: 2.0
- Date: 2026-09-01
- Status: REVIEW DRAFT — not activation approval
- Applies to source baseline: `81adaa8f502e0d8002e69bfe5c651e8ce88c57ee`
- Readiness migration: `20260831230000_v2_monitoring_push_activation_readiness.sql`
- Circuit-breaker migration: `20260901180000_v2_monitoring_push_circuit_breaker.sql`
- Staging project: `gscclrgcmvtbyquveoze`

This runbook contains secret identifiers only. Never paste a token, Vault value,
VAPID private JWK, service-role key, endpoint key material, or plaintext secret
into this file, chat, shell history, screenshots, logs, SQL output, or evidence
bundles.

## Scope and safety boundary

Monitoring delivery remains separate from confirmed safety-incident delivery.
This runbook never modifies `v2_alert_deliveries`, `v2-deliver-parent-push`, or
`check-device-health`.

Applying the circuit-breaker migration and deploying its reviewed worker source
would still not activate recurring delivery. The migration creates no cron job,
capability, Vault value, endpoint, Edge secret, or feature flag. Every staging
or production mutation requires its own explicit approval.

## Current verified baseline

- The two monitoring-delivery migrations and activation-readiness migration are
  deployed on staging.
- Gate B activation preparation completed once and established the two-stage
  cutoff. It must not be reset or repeated.
- Gate C proved one real `monitoring_interrupted` Web Push end to end for
  `yariv@kippyai.com`; the notification was visibly received on the installed
  iPhone PWA. No delivery to the other five guardians was observed.
- Gate C did not validate a restoration notification. The currently pending
  restoration row must not be replayed: leave it untouched until its normal TTL
  expires, then verify that no provider attempt was made for it.
- Recurring cron remains unapproved. This document and the Gate D patch are
  review artifacts only.

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
- `v2_monitoring_push_circuit_breaker`
- `v2_monitoring_push_dispatch_runs`
- `v2_prepare_monitoring_push_activation_internal()`
- `v2_dispatch_monitoring_push_worker_internal(integer)`
- `v2_report_monitoring_push_worker_run_service(...)`

The trigger token in Edge configuration and the trigger token stored under the
Vault identifier are the same secret, transferred through an approved secret
manager without displaying it. The database capability token and trigger token
are independently generated. PostgreSQL stores only the capability token's
SHA-256 digest.

`KIPPY_WEB_PUSH_VAPID_KEYS_JWK` is the cryptographic source of truth. The public
key setting must equal the application-server key exported from that exact JWK.
`v2-get-push-config` verifies equality at runtime and returns only the public
key. It returns 503 on missing, malformed, or mismatched configuration. The
frontend has no hardcoded or build-time fallback.

The VAPID configuration is shared with confirmed-incident Web Push. Do not
rotate or remove an approved shared keypair as part of monitoring-only rollback.
Any shared-key rotation requires its own safety-incident regression gate.

## Automatic circuit breaker

The dispatcher remains owner-only and the worker report RPC remains available
only to `service_role` after validating the dedicated monitoring capability.
Circuit state and dispatch-run evidence are inaccessible to `public`, `anon`,
`authenticated`, and `service_role` directly.

The circuit opens only for technical delivery failures:

1. Three consecutive failed worker runs observed through capability-protected
   reports or the 90-second unreported-run timeout.
2. Three consecutive failed executions of the one future cron job named
   `kippy-v2-monitoring-push`. A successful cron run resets only the cron streak.
3. More than 50% transient provider failures among at least four real provider
   attempts in the rolling five-minute window.

Monitoring transition volume, many disconnected devices, due-queue size,
delivery expiry, and `delivery_expired` results do not open the circuit. A mass
disconnect may be a real safety event and must remain visible.

While open, the dispatcher returns zero before reading Vault or queuing HTTP. It
does not delete, suppress, claim, lease, or reschedule monitoring deliveries. It
writes an audit event for the open transition and every blocked dispatch.

Cooldown is ten minutes. The first eligible dispatch after cooldown moves the
circuit to half-open and admits exactly one worker request regardless of the
requested bound. A technically successful probe closes a worker/cron circuit.
A provider-rate circuit closes only after a probe that actually reaches a
provider and has no transient result. A failed probe reopens the circuit with a
fresh cooldown; a provider probe with no provider attempt is inconclusive and
allows a later one-request probe. Successful close resets the provider sampling
boundary so old failures cannot reopen the circuit immediately.

`pg_cron` history is inspected by the dispatcher. If PostgreSQL is unavailable
or the job fails before the function can run, the state table cannot update at
that instant; the first later invocation that can read `cron.job_run_details`
records the missed outcomes and opens the circuit when the threshold is met.
Operational rollback therefore deactivates the named job but retains it and its
history until diagnosis is complete.

## Future recurring job shape

No migration schedules a job. After a separate approval, the database owner may
create exactly one job with this reviewed shape:

- name: `kippy-v2-monitoring-push`
- schedule: once per minute (`* * * * *`)
- database/user: the reviewed staging database and database owner
- command during initial rollout:
  `select public.v2_dispatch_monitoring_push_worker_internal(2);`
- steady-state command after evidence review:
  `select public.v2_dispatch_monitoring_push_worker_internal(4);`
- initial state: inactive

The SQL function rejects bounds outside 1–8. Do not use eight as the routine
bound: two during the controlled rollout and four at steady state cap worker
requests per minute. Each worker claims at most one delivery, each delivery has
a per-device lease, each delivery targets at most eight endpoints, and existing
delivery retry/TTL rules remain unchanged. The circuit breaker is the global
technical-failure stop; queue growth from real device disconnections is not.

## Eight-stage rollout

Every stage needs evidence from real staging accounts, browsers, and protected
devices. Synthetic rows or mocked provider acceptance are contract evidence,
not rollout proof. Stop between stages for explicit approval.

1. **Expire the old gap safely.** Keep cron absent and let the currently pending
   restoration row expire naturally. Under a separate approval, use one bounded
   manual cleanup invocation so normal TTL handling suppresses it without a
   provider call, then turn the flag off. Verify the row was retained and
   produced zero provider attempts. Reconfirm source/ledger, circuit closed, no
   active leases, and the exact guardian/device/endpoint inventory.
2. **Repeat the single-guardian proof.** With only the approved Yariv endpoint
   eligible, create a fresh real-device interruption and restoration. Manually
   dispatch one request at a time. Verify both notifications visibly arrive,
   ordering is interruption before restoration, no duplicate occurs, and the
   flag is turned off immediately afterward.
3. **Make the other five scopes real and healthy.** Before registering more
   endpoints, require a real active guardian session and a fresh protected
   device heartbeat for every intended family. Do not treat stale or synthetic
   devices as rollout proof. Stop if six real scopes cannot be established.
4. **Two-guardian manual pilot.** Register exactly one normal PWA endpoint for
   one additional guardian. With cron still absent, test fresh interruption and
   restoration events for the two guardians using bound 1. Verify strict family
   isolation, visible receipt, TTL, lease completion, and zero safety-lane
   mutation.
5. **Complete endpoint enrollment.** Register one normal PWA endpoint for each
   of the remaining four approved guardians. Reconcile exactly six eligible
   guardians, six healthy devices, and one active endpoint per guardian. Run a
   read-only isolation audit before any multi-guardian dispatch.
6. **Controlled cron at bound 2.** Under one approval window, create the named
   job inactive, verify its owner/schedule/command/uniqueness, set the flag true,
   then activate it. Observe ten consecutive one-minute runs. Require zero cron
   or worker failures, no circuit transition, no duplicate, no stale lease, and
   request/attempt counts within bound. Turn the flag off and deactivate the job
   before reviewing evidence.
7. **Steady bound and six-guardian soak.** After review, change only the named
   job to bound 4, re-enable it, and drive an approved real six-device burst that
   includes interruption and restoration. Verify each guardian receives only
   their family event. Continue for at least 60 clean cron runs; inspect the
   five-minute provider window, retries, queue age, and circuit audit after every
   anomaly.
8. **Approve continuous operation separately.** Only after the soak passes may
   staging remain unattended. Production requires a separate inventory,
   secrets, VAPID, real-family, privacy, and rollback approval; staging evidence
   does not authorize production activation.

## Stop conditions

Immediately set the flag false and deactivate the named job if any condition is
observed:

- source, migration ledger, function version, or job definition differs from
  the reviewed artifact;
- VAPID verification returns 503 or the exported public key does not match the
  configured public key;
- a token, private key, endpoint key, or decrypted Vault value is exposed;
- an unapproved guardian/endpoint is eligible, a guardian sees another family's
  event, or a child-content field appears in the generic payload;
- an old or pre-cutoff row is claimed, or an expired row reaches a provider;
  the pending Gate C restoration may be claimed only by the explicitly approved
  bound-1 expiry-cleanup step and must produce zero provider attempts;
- requests exceed the configured bound, a delivery is duplicated or reordered,
  a lease remains stale, or attempts continue after flag/job shutdown;
- the circuit opens, a half-open probe is not exactly one request, three cron or
  worker failures occur, or provider transient rate exceeds 50% with four or
  more attempts in five minutes;
- a safety-incident table/function changes or any monitoring SQL/Deno contract
  fails.

Do not manually force the circuit closed during an incident. Preserve its state
and audit evidence, diagnose the technical cause, and use the normal cooldown
and half-open path only after a reviewed fix.

## Rollback

Rollback stops external effects first and preserves evidence:

1. Set `KIPPY_MONITORING_PUSH_DELIVERY_ENABLED` false.
2. Mark only `kippy-v2-monitoring-push` inactive. Do not delete it while its run
   history is needed by the circuit and incident review.
3. Verify HTTP request, endpoint-attempt, and lease counts stop changing. Allow
   an existing lease to expire; do not requeue it manually.
4. Preserve queued/failed deliveries, circuit state, dispatch runs, endpoint
   attempts, and audit events. Do not delete, unsuppress, or bulk-reschedule.
5. For a credential or authorization incident, revoke the monitoring capability
   and rotate/remove only the two monitoring Vault entries and three dedicated
   monitoring Edge names under a separate security approval.
6. Do not remove or rotate shared VAPID configuration during monitoring-only
   rollback.
7. Confirm the worker returns 503 while disabled, the dispatcher returns zero
   while the circuit is open or configuration is absent, and no safety lane was
   changed.

The additive migrations, cutoff, circuit, functions, and audit evidence remain.
Do not run a down migration. Reactivation after a disabled interval requires a
new reviewed forward-only cutoff/suppression decision so dormant-gap rows cannot
be replayed unintentionally.

## Evidence record

For every stage, record the reviewed commit, operator, approval reference, UTC
start/end, migration/function versions, before/after aggregate counts, HTTP
status classes, cron run IDs, circuit state/reason, and PASS/FAIL decision.
Redact endpoint URLs and identifiers where practical. Record only public-key
fingerprints; never record tokens, private keys, Vault plaintext, subscription
authentication material, or service-role keys.
