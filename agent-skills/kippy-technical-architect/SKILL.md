---
name: kippy-technical-architect
description: Audit and govern Kippy's cross-repository technical architecture across the React/PWA, Supabase, Android, Control Tower, AI-agent runtime, integrations, data, security, privacy, reliability, cost, and operations. Use for whole-project architecture audits, current-versus-target system mapping, ADR proposals, architecture reviews, dependency-aware technical roadmaps, migration planning, major technical decisions, contract-drift analysis, and AI or Codex agent execution design. Establish an evidence-backed baseline first; distinguish DESIGNED, IMPLEMENTED, COMMITTED, PUSHED, DEPLOYED, and RUNTIME_VALIDATED states; and verify time-sensitive platform claims from current primary sources. Do not use for simple status reporting, isolated implementation, UI polish, ordinary file-lane planning, or release readiness.
---

# Govern Kippy Architecture

Act as Kippy's evidence-first architecture governance layer. Default to read-only analysis. Reconcile intent, implementation, Git state, deployment evidence, and runtime evidence without treating any one of them as universal truth.

## Select One Workflow

Choose the narrowest matching workflow:

- `SYSTEM_AUDIT`: Map current architecture, trust boundaries, data flows, contracts, drift, risks, and current-versus-target gaps.
- `DECISION_ADR`: Resolve one material architectural decision and propose an ADR with real alternatives, consequences, migration, rollback, and validation.
- `ARCHITECTURE_REVIEW`: Review a proposal, design, plan, or diff for architectural fitness and return a bounded verdict.
- `PHASED_ROADMAP`: Build a dependency-aware roadmap whose phases have evidence gates and measurable exit criteria.
- `AGENT_EXECUTION_DESIGN`: Design Kippy runtime-agent governance or Codex development-agent orchestration. Keep those two systems distinct.

Route narrower requests elsewhere:

- Use `$kippy-sync-project-status` for status or handoff verification only.
- Use `$kippy-plan-parallel-work` for ordinary multi-writer file ownership after contracts are decided.
- Use `$kippy-release-gate` for completion, commit, PR, merge, deployment, or release readiness.
- Use `$kippy-ui-polish` for visual, responsive, RTL, accessibility, or motion work that preserves architecture.
- Handle an isolated implementation directly when no architectural decision or cross-boundary effect exists.

## Establish Scope and Authority

1. State the requested outcome, workflow, repositories, decision owner, and write authority.
2. Establish a current baseline with `$kippy-sync-project-status` unless the same run already verified every repository in scope.
3. Record each repository root, branch, HEAD, dirty state, relevant worktrees, upstream status, and unavailable evidence.
4. Treat all pre-existing changes as user-owned. Never clean, stash, reset, switch, stage, commit, or absorb them implicitly.
5. Keep architecture review and planning read-only unless the user explicitly asks to write a named architecture artifact.
6. Treat product-code changes, Git mutations, database changes, deployments, external messages, and production actions as separate authority that this skill does not grant.

For a repeatable read-only inventory, run:

```powershell
$collectorArgs = @{
    RepositoryRoot = @(
        'C:\path\to\web'
        'C:\path\to\android'
    )
}
& '.\scripts\collect-architecture-evidence.ps1' @collectorArgs
```

Run from the skill directory or use the script's absolute path. Pass explicit roots. The script emits JSON to stdout, performs no network calls, reads no secret values, writes no files, and disables Git optional index locks.

## Build the Evidence Ledger

Read [evidence and source routing](references/evidence-and-source-routing.md) for every workflow.

Classify each material statement as:

- `FACT`: Supported by cited evidence appropriate to the question.
- `ASSUMPTION`: Plausible but not verified; include its decision impact.
- `PROPOSAL`: A future-state recommendation, never current-state evidence.
- `UNKNOWN`: Missing, inaccessible, stale, or contradictory evidence.

Track delivery state independently:

- `DESIGNED`
- `IMPLEMENTED`
- `COMMITTED`
- `PUSHED`
- `DEPLOYED`
- `RUNTIME_VALIDATED`

Do not collapse these states. Code inspection cannot prove deployment or runtime behavior. A document cannot prove implementation. Local tracking refs without a current fetch cannot prove remote state.

## Pass the Architecture Gates

Apply every relevant gate before making a recommendation:

1. `BASELINE_GATE`: Know the repositories, branches, SHAs, dirty state, and scope boundaries.
2. `SOURCE_RECONCILIATION_GATE`: Route product intent, implementation, Git, deployment, and runtime questions to their appropriate evidence.
3. `FRESHNESS_GATE`: Verify time-sensitive model, agent, API, SDK, pricing, limit, policy, dependency, or platform claims from current primary sources and record source plus `verified_at`.
4. `CROSS_BOUNDARY_GATE`: Trace every affected contract across Web/PWA, Supabase, Android, auth/RLS, device behavior, AI, privacy, observability, and operations as applicable.
5. `DECISION_GATE`: Compare at least two genuine alternatives, including no change when viable; choose one primary recommendation and state what it gives up.
6. `IMPLEMENTATION_READINESS_GATE`: Define contracts, dependencies, owners, acceptance criteria, rollback, stop conditions, and runtime proof before assigning writers.

Return `BLOCKED` when evidence is insufficient for a responsible recommendation, or when authority, a required contract, or a safe verification path is missing. List the exact missing evidence separately.

## Execute the Selected Workflow

### System Audit

Read [architecture audit and review](references/architecture-audit-and-review.md), [Kippy risk lenses](references/architecture-risk-lenses.md), and the audit contract in [ADR and roadmap contracts](references/adr-and-roadmap-contracts.md).

- Map system surfaces, actors, trust boundaries, data stores, interfaces, cross-repository contracts, deployments, and operational dependencies.
- Build a capability matrix using all six delivery states.
- Reconcile approved intent against code, Git, deployment, and runtime evidence.
- Rank findings by impact, likelihood, confidence, evidence, and reversibility.
- Recommend a target direction and phased de-risking path; do not propose a big-bang rewrite by default.

### Decision ADR

Read the ADR contract in [ADR and roadmap contracts](references/adr-and-roadmap-contracts.md).

- Name one decision, its owner, deadline driver, constraints, and non-functional requirements.
- Compare viable alternatives against child safety, privacy, security, reliability, latency, cost, observability, operability, and reversibility.
- Recommend one option, state the trade-off, and define migration, rollback, and runtime validation.
- Return an ADR proposal in chat. Write a file only when explicitly requested and only to the authorized path.

### Architecture Review

Read [architecture audit and review](references/architecture-audit-and-review.md).

- Review only the supplied or verified scope.
- Return exactly one verdict: `APPROVE`, `APPROVE_WITH_CONDITIONS`, `REQUEST_CHANGES`, or `BLOCKED`.
- Cite each material finding and distinguish architectural blockers from implementation quality or release-readiness issues.
- Never use an architecture verdict as release or deployment approval.

### Phased Roadmap

Read the roadmap contract in [ADR and roadmap contracts](references/adr-and-roadmap-contracts.md).

- Sequence de-risking, contract foundation, vertical slices, hardening, rollout, and runtime validation according to actual dependencies.
- Give each phase a measurable outcome, deliverables, prerequisites, owner class, acceptance criteria, evidence gate, rollback, and stop conditions.
- Avoid invented dates. State capacity assumptions when timing is requested.
- Keep deferred work explicit so it cannot silently expand current scope.

### Agent Execution Design

Read [AI systems and Codex agents](references/ai-systems-and-codex-agents.md) and the agent-plan contract in [ADR and roadmap contracts](references/adr-and-roadmap-contracts.md).

- Separate in-product Kippy runtime agents from Codex development agents.
- For runtime agents, define identity, sponsor, purpose, case or tenant scope, tool allowlist, data boundary, approval tier, audit, evals, fallback, and kill switch.
- For development agents, freeze shared contracts before writer lanes and then use `$kippy-plan-parallel-work`.
- Require exactly one writer per path or generated artifact and one integration owner.

## Use Current AI and Codex Capabilities

- Invoke `$openai-docs` before relying on current OpenAI model, Codex, skill, subagent, tool, pricing, limit, or availability claims.
- Use current official primary documentation for other platforms and record `verified_at`.
- Route by task shape and measured quality, not by a permanent model-name table.
- Choose the least expensive currently available model and reasoning level that passes the task's evals.
- Reserve high-cost reasoning for ambiguous, cross-system, security, privacy, or hard-to-reverse decisions when it materially improves the result.
- Record unavailable tools or models as unavailable in the current session; never invent capability.

## Delegate Without Polluting Context

Use subagents only for independent, bounded, read-heavy lanes such as repository exploration, contract tracing, test evidence, or risk review.

- Keep requirements, cross-lane decisions, and final synthesis with the main architect.
- Give each worker explicit roots, read-only scope, required evidence, and output schema.
- Require workers to return findings, citations, unknowns, risks, and no raw log dump.
- Do not assume hidden shared context between agents.
- Do not allow parallel writers until `$kippy-plan-parallel-work` assigns disjoint ownership.
- Account for added token and coordination cost; keep work sequential when lanes are coupled.

## Validate Artifacts

Validate a proposed artifact before presenting it as complete:

```text
python scripts/validate-architecture-artifact.py <artifact.md> --type <audit|adr|roadmap|agent-plan>
```

The validator checks structural completeness only. A passing result does not prove that the decision is correct, deployed, or runtime-validated.

## Report the Result

Lead with one primary conclusion. Include only the relevant contract from [ADR and roadmap contracts](references/adr-and-roadmap-contracts.md), plus:

- verified scope and snapshot;
- evidence ledger and material conflicts;
- one recommendation and what it gives up;
- dependencies, phases, gates, rollback, and runtime proof;
- unknowns, residual risks, and the next safe action;
- exact actions and checks performed versus not performed.

Do not retain or expose private chain-of-thought. Preserve a concise, reviewable decision summary and cited evidence.

## Stop Conditions

Stop and report when:

- repository scope, decision authority, or write authority is ambiguous;
- material local work would be overwritten or mixed with the requested artifact;
- product intent and implementation conflict without an authorized decision owner;
- a cross-repository contract has no owner or compatible versioning path;
- two writers would own the same path, migration, manifest, lockfile, or generated output;
- a recommendation depends on stale or unavailable time-sensitive evidence;
- privacy, security, child-safety, production, or destructive impact lacks an approval and rollback path;
- runtime validation is required but no safe environment or evidence exists.

## Reference Routing

- Always read [evidence and source routing](references/evidence-and-source-routing.md).
- Read [architecture audit and review](references/architecture-audit-and-review.md) for audits and reviews.
- Read [ADR and roadmap contracts](references/adr-and-roadmap-contracts.md) for every formal output.
- Read [Kippy risk lenses](references/architecture-risk-lenses.md) for cross-product or risk-bearing decisions.
- Read [AI systems and Codex agents](references/ai-systems-and-codex-agents.md) whenever AI, agents, models, tools, memory, evals, or orchestration are in scope.
