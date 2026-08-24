# Architecture Audit and Review

Use this rubric for `SYSTEM_AUDIT` and `ARCHITECTURE_REVIEW`. Inspect only relevant surfaces; do not load every repository or document without a scope reason.

## Contents

- [Establish the System Boundary](#establish-the-system-boundary)
- [Map the Current Architecture](#map-the-current-architecture)
- [Inspect Architecture Dimensions](#inspect-architecture-dimensions)
- [Build the Capability Matrix](#build-the-capability-matrix)
- [Record Findings](#record-findings)
- [Return an Architecture Review Verdict](#return-an-architecture-review-verdict)
- [Define the Target Direction](#define-the-target-direction)

## Establish the System Boundary

- Name the business outcome, users and operators, environments, repositories, and excluded scope.
- Identify actors, entry points, external providers, scheduled work, devices, browsers, and human approval points.
- Record current and target boundaries separately.
- Identify decision owners and contract owners.

## Map the Current Architecture

Create the smallest map that explains the decision:

1. System surfaces and repositories.
2. Runtime components, data stores, queues, functions, clients, and devices.
3. Public and internal interfaces: routes, RPCs, schemas, events, commands, generated types, and configuration.
4. Trust boundaries, identities, authentication, authorization, and service principals.
5. Data flows, retention, encryption, masking, and deletion paths.
6. Deployment units, environments, feature gates, observability, and operational ownership.
7. Failure paths, retry, idempotency, recovery, rollback, and kill switches.

Use a diagram only when it materially clarifies cross-boundary relationships. Cite every edge that drives a decision.

## Inspect Architecture Dimensions

### Product and Contracts

- Is current behavior aligned with approved product intent?
- Are cross-repository contracts explicit, versioned, and owned?
- Do producers and consumers agree on identity, schema, state transitions, errors, idempotency, and compatibility?
- Is legacy or donor code isolated from active runtime paths?

### Data, Privacy, and Security

- Is collection limited to the stated purpose and minimum required data?
- Are trust boundaries, RLS, roles, service credentials, field masking, and sensitive reads explicit?
- Are retention, deletion, legal hold, export, and audit behavior defined?
- Are minors' data and routine content excluded from unnecessary prompts, logs, analytics, and test artifacts?

### Reliability and Operations

- Are timeouts, retries, deduplication, idempotency, ordering, offline behavior, and partial failure defined?
- Can operators distinguish intent, dispatch, acknowledgment, result, and verification?
- Are health signals, SLOs, alerting, ownership, runbooks, rollback, and kill switches present?
- Does the design fail closed where a false success would create safety, privacy, or authorization risk?

### Evolution and Cost

- Is the change incremental, reversible, observable, and compatible with existing clients?
- Are migration order, backfill, dual-read/write periods, cleanup, and rollback explicit?
- Are latency, model/tool cost, storage, provider dependency, and operational load measured or labeled as assumptions?
- Does a proposed abstraction solve a verified repeated need rather than speculative future complexity?

## Build the Capability Matrix

For each material capability, record:

| Capability | Designed | Implemented | Committed | Pushed | Deployed | Runtime validated | Evidence / gap |
|---|---:|---:|---:|---:|---:|---:|---|
|  | yes/no/unknown | yes/no/unknown | yes/no/unknown | yes/no/unknown | yes/no/unknown | yes/no/unknown |  |

Do not use a single status column.

## Record Findings

Use this shape:

```text
Finding: <specific mismatch or risk>
Severity: <CRITICAL | HIGH | MEDIUM | LOW>
Class: <FACT | ASSUMPTION | UNKNOWN>
Evidence: <citations>
Impact: <user, safety, privacy, reliability, cost, or delivery consequence>
Likelihood: <high | medium | low | unknown>
Confidence: <high | medium | low>
Recommendation: <one bounded action>
Validation: <evidence that would close the finding>
Owner: <decision or implementation owner, or unknown>
```

Rank by impact and evidence, not by novelty.

## Return an Architecture Review Verdict

Use exactly one:

- `APPROVE`: No material architecture condition remains within the reviewed scope.
- `APPROVE_WITH_CONDITIONS`: Direction is acceptable, but named conditions must be satisfied before implementation or rollout.
- `REQUEST_CHANGES`: A fixable contract, boundary, reliability, security, privacy, or operability problem exists.
- `BLOCKED`: Evidence, authority, scope, or a prerequisite decision is missing.

List conditions as verifiable statements. Do not imply release readiness, deployment approval, or runtime validation.

## Define the Target Direction

- Preserve approved product invariants and working implementation unless evidence justifies change.
- Prefer a vertical slice that proves the hardest cross-boundary contract.
- Make reversible decisions early and delay irreversible commitments until evidence is sufficient.
- State what will not be changed now.
- Convert unresolved material choices into owned ADRs, not hidden assumptions.
