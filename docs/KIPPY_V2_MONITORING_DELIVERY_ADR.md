# ADR: Dedicated V2 monitoring push delivery lane

## Status

ACCEPTED — DORMANT STAGING DEPLOYED; ACTIVATION NOT APPROVED

## Date and Owner

- Date: 2026-08-31
- Decision owner: Kippy founder / CTO
- Implementers: Supabase backend and guardian PWA owners

## Context

Kippy V2 already records device-health events, projects monitoring state, writes
state transitions, and enqueues guardian-specific rows in
`v2_monitoring_alert_deliveries`. The liveness cron runs every minute and the
database has runtime evidence for heartbeat, late, interrupted, and restored
transitions.

No deployed RPC, trigger, cron job, or Edge Function consumes the monitoring
outbox. The deployed `v2-deliver-parent-push` worker consumes
`v2_alert_deliveries` only and builds a confirmed safety-incident payload. That
worker must not be extended by inserting operational monitoring events into the
safety-incident table or `/alerts-v2` route.

The 2026-08-31 audit observed 534 monitoring rows in `queued`: 505 were older
than seven days and 390 were associated with devices that are now `revoked`.
Enabling delivery against that backlog would create stale and potentially
confusing notifications.

## Decision Drivers

- Keep operational monitoring separate from confirmed child-safety incidents.
- Prevent stale, duplicate, or out-of-order notifications.
- Reuse the proven Web Push endpoint, VAPID, HTTP classification, lease, retry,
  and endpoint-invalidation patterns.
- Fail closed when the worker, database capability, Vault trigger, or feature
  flag is absent.
- Avoid child names, routine content, and safety-incident content in lock-screen
  payloads.
- Keep the change additive, reversible, observable, and testable in a disposable
  database before staging activation.

## Constraints

- `check-device-health` remains excluded and is not modified or revived.
- `v2_alert_deliveries` remains restricted to confirmed safety incidents.
- `/alerts-v2` remains restricted to confirmed parent-safe incidents.
- Existing deployed function bundles contain several historical `_shared` file
  versions; implementation must start from the exact `v2-deliver-parent-push`
  v36 snapshot instead of flattening all snapshots.
- No linked migration, function deployment, secret change, cron change, or push
  invocation is authorized by this ADR.
- Guardian membership, device status, endpoint status, RLS, and service-role
  boundaries must be re-evaluated at claim time, not trusted from enqueue time.

## Options Considered

### Option A

Create a dedicated monitoring claim/complete RPC pair and a dedicated
`v2-deliver-monitoring-push` Edge Function. Reuse the existing guardian Web Push
endpoints, VAPID configuration, provider-status classifier, and endpoint
invalidation behavior. Keep a separate capability token, trigger token, payload
contract, retry policy, and cron dispatch path.

### Option B

Generalize the existing incident worker so one RPC claims from both outbox
tables and returns a union payload. This reduces one function and cron job, but
widens the incident worker's authority, couples unrelated status machines, and
makes rollback and incident-only reasoning harder.

### No Change

Keep monitoring state visible in the guardian UI without push delivery. This
avoids notification risk but leaves the existing monitoring outbox permanently
unconsumed and does not deliver the intended interruption/restoration signal.

## Decision

Choose Option A.

Add a dedicated monitoring delivery lane with these contracts:

1. A forward-only migration extends `v2_monitoring_alert_deliveries` with
   `attempt_count`, `next_attempt_at`, `lease_owner`, `lease_token_hash`,
   `lease_expires_at`, `expires_at`, `suppressed_at`, and
   `suppression_reason`. Existing rows and statuses remain compatible.
2. A monitoring-specific capability table and constant-time validator authorize
   only the monitoring claim/complete RPCs. The incident capability remains
   unchanged.
3. `v2_claim_monitoring_delivery_service(capability_token, worker_id,
   lease_seconds)` claims at most one due row using `FOR UPDATE SKIP LOCKED` and
   returns one typed claim plus active endpoints. The function rechecks current
   guardian membership, device status, transition relevance, age, and endpoint
   status before leasing. Claiming is serialized per device: while any
   unexpired monitoring-delivery lease exists for a device, no parallel worker
   may claim another delivery for that device.
4. `v2_complete_monitoring_delivery_service(capability_token, worker_id,
   lease_token, delivery_id, results)` validates the lease, records per-endpoint
   outcomes, invalidates 404/410 endpoints, marks provider acceptance accurately,
   and schedules bounded retry for transient failures.
5. `v2-deliver-monitoring-push` uses the same Web Push provider and VAPID secrets
   as the incident worker, but uses dedicated trigger and database capability
   tokens plus `KIPPY_MONITORING_PUSH_DELIVERY_ENABLED=false` by default.
6. The payload contract is `contract_version: 1` and
   `type: "kippy_monitoring_status"`. It contains only the alert type, severity,
   transition identifier, and an authenticated V2 monitoring route. Visible
   title/body text is generic and does not include the child name or incident
   content.
7. `monitoring_late` remains an in-app state and is suppressed for push.
   `monitoring_action_required` and `monitoring_interrupted` are push-eligible.
   `monitoring_restored` is push-eligible only when a disruption from the same
   device episode was previously provider-accepted for that guardian.
8. New action-required and interrupted rows expire after six hours. New restored
   rows expire after one hour. The enqueue function stops creating delivery rows
   for `monitoring_late`; the transition itself remains the audit record.
9. Provider TTL is a delivery contract, not a worker default. Immediately before
   each Web Push request, the worker calculates the positive whole seconds
   remaining until the claim's `expires_at` and sends
   `min(86400, remaining_seconds)` as the provider TTL. If no positive time
   remains, it makes no provider request and completes the row as suppressed with
   `delivery_expired`. A fixed `86400` TTL is forbidden for monitoring delivery.

### Proposed RPC shapes

The claim RPC returns no row when no eligible work exists. A successful claim
returns exactly one row with `delivery_id`, `transition_id`, `device_id`,
`child_id`, `episode_id`, `transition_state_version`, `alert_type`, `severity`,
`lease_token`, `attempt_number`, `expires_at`, and `targets`. Each target
contains only `endpoint_id`, `endpoint`, `p256dh`, and `auth`; a claim contains
at most eight targets.

The completion RPC accepts the same bounded target-result array used by the
incident worker: `endpoint_id`, `outcome`, optional `http_status`, and optional
`error_code`. It returns `delivery_status`, `provider_accepted_count`,
`invalid_target_count`, `retry_scheduled`, and optional `suppression_reason`.
Lease fields, not a new public status, represent in-flight work.

Per-device serialization must persist for the full external-send window. In the
same transaction that selects a candidate, the claim RPC locks the canonical
`v2_device_monitoring_state` row, suppresses any superseded delivery rows, checks
that no other delivery for the device has an unexpired lease, and then writes the
new lease. A transaction-only row lock is insufficient: later claim transactions
must observe the persisted active lease and skip that device until completion or
lease expiry. Workers remain parallel across different devices.

The dedicated Edge configuration names are
`KIPPY_MONITORING_PUSH_DELIVERY_ENABLED`,
`KIPPY_MONITORING_PUSH_WORKER_TRIGGER_TOKEN`, and
`KIPPY_MONITORING_PUSH_DB_CAPABILITY_TOKEN`. The worker reuses the existing
`KIPPY_WEB_PUSH_*` VAPID configuration. Database dispatch reads only
`kippy_v2_monitoring_push_worker_endpoint` and
`kippy_v2_monitoring_push_worker_trigger_token` from Vault.

Claim-time suppression rules are deterministic and auditable:

- current device status is `revoked`;
- guardian membership is no longer active for the device family;
- no active, granted endpoint exists;
- the row predates the approved activation cutoff or exceeds the delivery TTL;
- the transition is no longer relevant to current monitoring state;
- the row is `monitoring_late`; or
- a restoration has no previously accepted disruption in the same episode.

### Relevance, precedence, and ordering contract

Relevance is evaluated atomically at claim time against the current device state,
the transition's `state_version` and `episode_id`, and all delivery rows for that
device. The following table is normative:

| Queued delivery | Claim-time condition | Required decision |
|---|---|---|
| `monitoring_action_required` | The same episode is still in `action_required`, and no later transition supersedes it. | Eligible after the common membership, device, endpoint, cutoff, and TTL checks. |
| `monitoring_action_required` | The same episode has advanced to `interrupted`, or a queued/leased interruption with a higher `state_version` exists. | Suppress as `superseded_by_interrupted`. The interruption wins and the action-required row is never sent later. |
| `monitoring_action_required` | The device is recovering, restored, or in a newer episode before this row is leased. | Suppress as `superseded_by_recovery_or_newer_episode`. |
| `monitoring_late` | Any state. | Always suppress as `monitoring_late_in_app_only`; it never reaches Web Push. |
| `monitoring_interrupted` | The same episode is still `interrupted`, no newer transition supersedes it, and no other lease exists for the device. | Eligible. It has precedence over unsent action-required and late rows from the same episode. |
| `monitoring_interrupted` | Recovery or a newer episode is already current before this row is leased. | Suppress as `superseded_by_recovery_or_newer_episode`. |
| `monitoring_restored` | The restoration is the latest relevant transition for the completed episode, the current state is `protected` or `degraded`, and at least one action-required or interrupted delivery from that episode was previously `provider_accepted` for the guardian. | Eligible only after every earlier lease for the device is completed or expired. |
| `monitoring_restored` | No disruption from that episode was provider-accepted, including when the disruption was suppressed by the activation cutoff, revoked-device cleanup, expiry, or missing endpoint. | Suppress as `restoration_without_accepted_disruption`. This is an intentional, accepted loss: Kippy does not send “restored” to a guardian who was not sent the corresponding disruption. It is never replayed or unsuppressed. |
| Any alert | The device is revoked, membership is inactive, the row predates the activation cutoff, the row is expired, or no active granted endpoint exists. | Suppress using the deterministic common reason; it cannot become eligible later. |

For `action_required -> interrupted` in one episode, `interrupted` is the single
winning unsent signal. If action-required was already provider-accepted before
the interruption transition, interruption remains eligible as a later escalation.
The claim/complete lane permits only one active lease per device, so a restoration
cannot be claimed or submitted by Kippy before the earlier disruption attempt is
completed. This guarantees database claim order and provider-submission order;
third-party Web Push providers can still delay or reorder delivery after
acceptance, so visible text remains generic and the authenticated route always
loads canonical current state.

## Activation-readiness amendment (version 1)

The approved dormant deployment established a deployment-time cutoff but did
not authorize delivery. A second, explicit enablement boundary is required:

1. `dormant_deployment_cutoff` preserves the cutoff recorded by the dormant
   deployment. `enablement_prepared_at` remains null until an owner explicitly
   prepares a controlled activation.
2. A monitoring capability is invalid while `enablement_prepared_at` is null,
   even if an active capability row exists and its token is correct.
3. The owner-only preparation function locks the monitoring outbox against
   concurrent inserts, captures its effective cutoff from the server clock only
   after acquiring that lock, suppresses every pending row created before the
   cutoff, advances the claim boundary, records aggregate audit evidence, and
   can succeed only once. A caller cannot supply a stale cutoff. Rows are
   retained, never replayed or deleted.
4. The owner-only dispatcher is deliberately unscheduled, accepts a bound of
   one through eight HTTP requests, returns zero when work or either exact
   monitoring Vault value is absent, and cannot be executed by `public`, `anon`,
   `authenticated`, or `service_role`.
5. `KIPPY_WEB_PUSH_VAPID_KEYS_JWK` is the cryptographic source of truth. Both
   push workers and the authenticated `v2-get-push-config` path import it and
   verify that its exported application-server key exactly matches
   `KIPPY_WEB_PUSH_PUBLIC_KEY`. A mismatch fails closed; the guardian frontend
   has no hardcoded or build-time fallback.
6. The readiness migration creates no capability, Vault value, endpoint, cron
   job, secret, or feature activation. Operational steps and rollback order are
   versioned in `KIPPY_V2_MONITORING_ACTIVATION_RUNBOOK.md`.

## Consequences

- Monitoring and safety-incident queues retain independent schemas, permissions,
  payloads, retries, observability, and rollback controls.
- The low-level Web Push behavior and endpoint registry are reused without
  changing the deployed incident worker.
- A second worker, capability, trigger secret, and cron dispatch path must be
  operated.
- Monitoring delivery status can be measured without conflating it with safety
  incident delivery metrics.
- The first rollout cannot replay the historical queue.
- The monitoring worker deliberately retains the incident worker's existing
  at-least-once ambiguity: a crash after the Web Push provider accepts a request
  but before the completion transaction commits can cause a duplicate after the
  lease expires. This known risk is accepted for monitoring-alert severity and
  is not represented as exactly-once delivery. Per-device serialization prevents
  concurrent ordering inversions but does not remove this crash-window trade-off.

## Trade-offs

The design deliberately accepts a small amount of duplicated orchestration and
one additional cron path. It gives up the operational simplicity of one generic
worker in exchange for least privilege, clearer incident boundaries, safer
rollback, and independently testable delivery semantics.

## AI, Security, and Privacy Impact

No AI model or child-content processing is added.

The Edge Function remains `verify_jwt=false` only because it is invoked by a
database-controlled trigger path. It must require a constant-time trigger-token
check before creating a service client. Database RPCs remain `SECURITY DEFINER`,
use an empty `search_path`, revoke execute from `public`, `anon`, and
`authenticated`, and grant only the minimum required service role.

Push payloads contain no child name, raw messages, location, incident content,
credentials, or endpoint secrets. Endpoint material remains service-role-only.

## Migration

1. **Source gate:** before applying the readiness patch, require 61 matched
   migrations, zero remote-only, exactly one reviewed local-only migration
   (`20260831230000`), and a dry-run containing nothing else.
2. **Contract migration:** add the delivery columns, monitoring capability,
   claim/complete functions, `v2_monitoring_push_endpoint_attempts`, indexes,
   grants, expiry policy, enqueue update, and disposable SQL contract tests. Do
   not schedule or enable delivery.
3. **Two-phase suppression:** the deployed backlog migration preserves its
   deployment-time cutoff. At a later, separately approved activation, the
   owner-only preparation function atomically suppresses the entire additional
   dormant-to-enablement gap and advances the effective claim cutoff. Preserve
   rows rather than deleting them.
4. **Edge implementation:** add the monitoring claim/payload module and worker,
   importing the generic endpoint/status helpers from the exact incident-worker
   v36 source. Do not modify the incident worker in the first slice.
5. **Dormant deployment:** completed on staging with feature flag false, no
   monitoring cron, no capability row, and no monitoring Vault values.
6. **Activation-readiness deployment:** after independent review and separate
   approval, apply only the forward migration and deploy only the reviewed
   monitoring worker and push-config sources. Keep every activation input
   absent or disabled.
7. **Controlled staging activation:** under a new approval, configure dedicated
   tokens and exact Vault references, use one explicitly approved real staging
   test guardian/browser endpoint, prepare the activation cutoff, and validate
   one real-device interruption followed by one restoration before scheduling
   recurring dispatch.
8. **Expansion:** enable additional staging guardians only after delivery,
   duplicate, retry, endpoint invalidation, and privacy evidence pass.

The audited counts (534 total, 505 older than seven days, 390 associated with
revoked devices) are evidence for review, not hard-coded migration assertions.
The activation migration records the actual counts at execution time so later
rows cannot invalidate the audit trail. It records separate counts for total
queued, pre-cutoff, older-than-seven-days, revoked-device, their overlap, and the
remaining eligible set. When a row qualifies for more than one primary reason,
reason precedence is `device_revoked`, then `pre_activation_cutoff`, then
`delivery_expired`; the overlap counts remain available in audit metadata. A
restoration from any episode whose disruption was suppressed by this cleanup is
also suppressed under `restoration_without_accepted_disruption` if it later
reaches claim evaluation.

## Rollback

- Set `KIPPY_MONITORING_PUSH_DELIVERY_ENABLED=false` and disable the monitoring
  cron dispatch path.
- Revoke or expire the monitoring capability token and remove the Vault trigger
  references.
- Allow active leases to expire; do not convert historical `suppressed` rows
  back to `queued`.
- Leave additive columns, audit rows, and functions in place until a later
  reviewed cleanup migration. The guardian UI continues to read canonical
  monitoring state even when push is disabled.

## Validation

Before any linked change:

- `supabase migration list --linked --workdir supabase-v2` reports 61 matched,
  zero remote-only, and only the reviewed readiness migration as local-only.
- This ledger assertion proves migration parity only, not absolute live
  schema zero-drift. `supabase-v2/README.md` documents 11 WhatsApp-canary objects
  whose DDL provenance is outside the 59-file history; they remain an explicit,
  separate reconciliation item and are not part of this monitoring gate.
- Snapshot paths and manifest entries match all active non-legacy provider
  versions and hashes.
- Migration lint and disposable database reset succeed locally.
- SQL contracts prove suppression scope, active-membership/device checks,
  one-active-lease-per-device concurrency, action-required/interrupted
  precedence, lease validation, deterministic post-completion behavior, bounded
  retry, endpoint invalidation, restoration gating, intentional restoration loss
  after disruption suppression, RLS, and grants.
- Deno tests prove strict claim parsing, privacy-safe payloads, provider outcome
  classification, constant-time trigger authentication, and dynamic provider TTL:
  it equals the positive whole seconds remaining to `expires_at`, is capped at
  86400, and no provider call occurs at or after expiry.

Staging runtime acceptance requires explicit approval and then proves:

- no pre-cutoff or revoked-device row is delivered;
- a rapid real-device `action_required -> interrupted` episode sends only the
  winning interruption when action-required was not already accepted;
- parallel workers never hold two simultaneous leases for one device, while
  different devices can still be processed concurrently;
- one real-device interruption produces one normal provider-accepted result;
- concurrent and post-completion duplicate claims do not resend, while the
  documented crash-after-provider-acceptance ambiguity is not claimed as an
  exactly-once guarantee;
- restoration is submitted only after the accepted disruption and only once in
  the normal completion path;
- restoration is suppressed when the matching disruption was suppressed by the
  historical cleanup or otherwise never provider-accepted;
- provider TTL never exceeds either 86400 seconds or the remaining row lifetime;
- disabling the flag or revoking the capability stops dispatch immediately;
- no child name or content appears in payloads, logs, or test artifacts.

Stop deployment if the migration ledger drifts, the backlog preflight cannot be
explained, active endpoints are not synthetic/approved, required secrets are
missing, or any contract test fails.

## Evidence

- `supabase-v2/supabase/migrations/20260728110000_v2_monitoring_liveness.sql:90`
  defines the monitoring state machine, outbox, endpoint registry, and enqueue
  function.
- `supabase-v2/supabase/migrations/20260731030000_v2_guardian_web_push_delivery.sql:534`
  defines the existing incident-specific claim/complete and fail-closed dispatch
  pattern.
- `supabase-v2/supabase/deployed-sources/gscclrgcmvtbyquveoze/manifest.json:1`
  records current provider versions and bundle hashes captured on 2026-08-31.
- `supabase-v2/supabase/deployed-sources/gscclrgcmvtbyquveoze/functions/v2-deliver-parent-push/v36/supabase/functions/v2-deliver-parent-push/index.ts:1`
  contains the exact deployed incident worker and transport source.
- Read-only linked audit on 2026-08-31 observed 534 queued rows, including 505
  older than seven days and 390 associated with revoked devices.

Verified at: 2026-08-31T14:54:38+03:00 against linked project
`gscclrgcmvtbyquveoze` and the remote-verified source branches named above.

## Supersession

- Supersedes: legacy V1 `check-device-health` as a candidate monitoring delivery
  solution; it remains excluded rather than modified.
- Superseded by: none
