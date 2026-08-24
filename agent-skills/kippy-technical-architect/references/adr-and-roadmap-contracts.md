# ADR and Roadmap Contracts

Use these templates for formal output. Remove placeholders before validation. Keep evidence concise and link to raw artifacts rather than copying them.

## Contents

- [Architecture audit](#architecture-audit)
- [Architecture decision record](#architecture-decision-record)
- [Technical roadmap](#technical-roadmap)
- [Agent execution plan](#agent-execution-plan)

## Architecture Audit

```markdown
# Kippy Architecture Audit

## Snapshot

- Captured at:
- Repositories, branches, and SHAs:
- Environments:
- Write authority:

## Scope

- Objective:
- Included:
- Excluded:

## Current Architecture

<System surfaces, boundaries, dependencies, and data/control flows.>

## Evidence

<Evidence ledger with FACT, ASSUMPTION, PROPOSAL, and UNKNOWN.>

## Capability Matrix

<DESIGNED, IMPLEMENTED, COMMITTED, PUSHED, DEPLOYED, RUNTIME_VALIDATED.>

## Source Conflicts

<Conflict, sources, consequence, owner, and resolution evidence required.>

## Findings

<Severity-ranked findings with evidence, impact, confidence, and recommendation.>

## Risks

<Residual safety, privacy, security, reliability, cost, and delivery risks.>

## Recommendation

<One primary target direction and what it gives up.>

## Phased Roadmap

<Dependencies, outcomes, exit criteria, rollback, and runtime gates.>

## Unknowns

<Material missing evidence.>

## Next Safe Action

<One bounded action.>
```
## Architecture Decision Record

```markdown
# ADR: <decision title>

## Status

<PROPOSED | ACCEPTED | SUPERSEDED | REJECTED>

## Date and Owner

- Date:
- Decision owner:
- Implementers:

## Context

<Problem and current evidence.>

## Decision Drivers

<Measurable functional and non-functional drivers.>

## Constraints

<Product, safety, privacy, security, compatibility, operational, and capacity constraints.>

## Options Considered

### Option A

### Option B

### No Change

## Decision

<One primary choice.>

## Consequences

<Positive, negative, and follow-on consequences.>

## Trade-offs

<What is deliberately given up.>

## AI, Security, and Privacy Impact

<Applicable impact or explicitly not applicable with evidence.>

## Migration

<Sequenced compatibility and data transition plan.>

## Rollback

<Reversal or compensating control.>

## Validation

<Tests, runtime postconditions, observability, and acceptance gates.>

## Evidence

<Cited sources and verified timestamps.>

## Supersession

- Supersedes:
- Superseded by:
```

## Technical Roadmap

```markdown
# Kippy Technical Roadmap

## Objective

<Outcome and terminal condition.>

## Baseline

<Repositories, SHAs, delivery states, and unknowns.>

## Dependencies

<Dependency graph and sequencing constraints.>

## Contracts

<Contract, owner, consumers, and freeze condition.>

## Phases

### Phase 0: De-risk

- Outcome:
- Prerequisites:
- Deliverables:
- Owner class:
- Exit Criteria:
- Runtime Validation:
- Rollback:
- Stop Conditions:
- Deferred work:

### Phase 1: Foundation or Vertical Slice

- Outcome:
- Prerequisites:
- Deliverables:
- Owner class:
- Exit Criteria:
- Runtime Validation:
- Rollback:
- Stop Conditions:
- Deferred work:

## Exit Criteria

<Roadmap-level completion conditions.>

## Runtime Validation

<Environment, version, scenarios, and postconditions.>

## Rollback

<Phase and release rollback strategy.>

## Risks

<Risk, likelihood, impact, mitigation, owner, and evidence.>

## Evidence

<Sources and freshness timestamps.>

## Unknowns

<Capacity, dependency, or evidence gaps.>

## Next Safe Action

<One bounded action.>
```

## Agent Execution Plan

```markdown
# Kippy Agent Execution Plan

## Objective

<Outcome and terminal condition.>

## Capability Snapshot

<Available agents, tools, permissions, source, and verified_at.>

## Baseline

<Repositories, branches, SHAs, dirty work, and contracts.>

## Dependencies

<DAG and contract freeze order.>

## Contracts

<Shared contract, sole owner, consumers, and freeze gate.>

## Work Lanes

<Lane, mode, exact read/write scope, context pack, output, and verifier.>

## Ownership

<Exactly one writer per path and one integration owner.>

## Integration Order

<Topological handoffs and incremental verification.>

## Exit Criteria

<Evidence required from every lane and from integration.>

## Runtime Validation

<Post-integration runtime proof.>

## Rollback

<Lane and integration recovery.>

## Stop Conditions

<Ownership, contract, base, evidence, permission, or validation failures.>

## Risks

<Coordination, context, cost, security, and delivery risks.>

## Evidence

<Capability and project sources with verified_at where volatile.>

## Next Safe Action

<One bounded action.>
```
