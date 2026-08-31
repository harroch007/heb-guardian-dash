# ADR: Dedicated V2 monitoring push delivery lane

## Status

PROPOSED

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
   status before leasing.
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

### Proposed RPC shapes

The claim RPC returns no row when no eligible work exists. A successful claim
returns exactly one row with `delivery_id`, `transition_id`, `device_id`,
`child_id`, `episode_id`, `alert_type`, `severity`, `lease_token`,
`attempt_number`, `expires_at`, and `targets`. Each target contains only
`endpoint_id`, `endpoint`, `p256dh`, and `auth`.

The completion RPC accepts the same bounded target-result array used by the
incident worker: `endpoint_id`, `outcome`, optional `http_status`, and optional
`error_code`. It returns `delivery_status`, `provider_accepted_count`,
`invalid_target_count`, `retry_scheduled`, and optional `suppression_reason`.
Lease fields, not a new public status, represent in-flight work.

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

1. **Source gate:** require 59 matched migrations, zero remote-only, zero
   local-only, and exact deployed-source snapshots under the canonical workdir.
2. **Contract migration:** add the delivery columns, monitoring capability,
   claim/complete functions, `v2_monitoring_push_endpoint_attempts`, indexes,
   grants, expiry policy, enqueue update, and disposable SQL contract tests. Do
   not schedule or enable delivery.
3. **Historical suppression:** in the activation migration, define an explicit
   reviewed UTC cutoff. In one transaction, mark every still-queued row older
   than the cutoff or linked to a revoked device as `suppressed`; set
   `suppressed_at` and a reason code; write aggregate before/after counts and the
   cutoff to `v2_audit_events`. Preserve rows rather than deleting them.
4. **Edge implementation:** add the monitoring claim/payload module and worker,
   importing the generic endpoint/status helpers from the exact incident-worker
   v36 source. Do not modify the incident worker in the first slice.
5. **Dormant deployment:** deploy migration and function only after explicit
   approval, with feature flag false, no cron, and no capability row.
6. **Controlled staging activation:** configure dedicated tokens and Vault
   endpoint, register one synthetic guardian endpoint, set the activation cutoff,
   enable the cron, and test one interruption followed by one restoration.
7. **Expansion:** enable additional staging guardians only after delivery,
   duplicate, retry, endpoint invalidation, and privacy evidence pass.

The audited counts (534 total, 505 older than seven days, 390 associated with
revoked devices) are evidence for review, not hard-coded migration assertions.
The activation migration records the actual counts at execution time so later
rows cannot invalidate the audit trail.

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

- `supabase migration list --linked --workdir supabase-v2` reports 59/0/0.
- Snapshot paths and manifest entries match all active non-legacy provider
  versions and hashes.
- Migration lint and disposable database reset succeed locally.
- SQL contracts prove suppression scope, active-membership/device checks,
  single-claim concurrency, lease validation, idempotent completion, bounded
  retry, endpoint invalidation, restoration gating, RLS, and grants.
- Deno tests prove strict claim parsing, privacy-safe payloads, provider outcome
  classification, and constant-time trigger authentication.

Staging runtime acceptance requires explicit approval and then proves:

- no pre-cutoff or revoked-device row is delivered;
- one synthetic interruption produces at most one provider-accepted push;
- a duplicate claim cannot send a second push;
- restoration is sent only after the accepted disruption and only once;
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
