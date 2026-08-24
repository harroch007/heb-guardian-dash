---
name: kippy-plan-parallel-work
description: Plan and coordinate Kippy work that will be split across two or more agents, developers, branches, repositories, or worktrees. Use when dividing a feature into parallel lanes, deciding what can run concurrently, assigning file or contract ownership, mapping cross-lane dependencies, defining handoffs, recovering overlapping agent work, or integrating several related changes. Require one writer per path, explicit dependencies and stop conditions, a named integration owner, and incremental merge gates. Do not use for a single isolated implementation, ordinary project-status reporting, standalone review, or release verification without parallel coordination.
---

# Plan Parallel Kippy Work

Create dependency-aware work lanes that can be developed and integrated without overlapping writers or a big-bang merge.

## Establish the Baseline

- Use `$kippy-sync-project-status` first when repository state is not already verified.
- Record every repository, branch, base SHA, worktree, dirty file, and untracked file in scope.
- Treat pre-existing changes as user-owned work; never overwrite, stash, move, or absorb them implicitly.
- Distinguish verified repository state from information that exists only in another agent thread.

## Decide Whether to Parallelize

Parallelize only when at least two lanes have:

- Separate deliverables.
- Disjoint write scopes, or a shared artifact with one designated writer.
- Explicit inputs and outputs.
- Independent lane-level verification.

Keep work sequential when ownership cannot be exclusive, a contract is undecided, or the work centers on the same files.

If agents already have overlapping scopes, pause the writers, inventory their changes, select one owner, and convert the other agent to a reviewer or handoff producer.

## Build the Work Graph

1. State the outcome and measurable acceptance criteria.
2. Identify contracts before implementations: schema, RPC payloads, device commands, generated types, routes, configuration, and public interfaces.
3. Map dependency edges between lanes.
4. Assign one writer to every file or path glob.
5. Assign one owner to every shared contract and generated artifact.
6. Name one integration owner.
7. Define topological integration order and a verification gate after each lane.

Read [the plan and handoff templates](references/plan-and-handoff-templates.md) whenever producing a plan or accepting a lane handoff.

Do not start writer lanes while any write scope, contract owner, dependency, or integration owner is ambiguous.

## Enforce Ownership

- Allow exactly one active writer per file or path.
- Treat unlisted paths as read-only.
- Keep reviewers and researchers read-only unless ownership is explicitly transferred.
- Assign glue files and unavoidable shared entrypoints to the integration owner.
- Assign package manifests and lockfiles to one lane.
- Assign a generated file to the same lane as its source, or to one dedicated generation lane.
- Serialize database migrations whose order or contract can interact.
- Keep Android and Web repository baselines separate; record their cross-repository contract.
- Forbid opportunistic refactors, formatting, dependency upgrades, and unrelated cleanup outside lane scope.

When a lane needs an unowned file, stop and update the plan. Transfer ownership explicitly; never allow old and new owners to edit concurrently.

## Select the Execution Model

Prefer a dedicated branch and worktree per writer when agents need independent Git operations.

When agents share one checkout:

- Permit only disjoint file writes.
- Forbid workers from switching branches, pulling, rebasing, staging, or committing.
- Let the integration owner inspect, stage, verify, and commit intentional changes.
- Recheck `git status` before and after every handoff.

Record the execution model in the plan.

## Integrate Incrementally

- Require a complete lane handoff before integration.
- Integrate in dependency order, one lane at a time.
- Inspect each lane diff against its assigned scope.
- Run lane checks before integration and contract or build checks immediately after it.
- Create a verified checkpoint before accepting the next lane.
- Stop the queue on conflicts, contract drift, unexpected files, or failed checks.
- Resolve cross-lane conflicts through the recorded owner and contract; never choose conflict sides mechanically.
- Do not wait for all lanes and combine them in one big-bang merge.
- Run `$kippy-release-gate` after all incremental integrations are complete.

## Stop Conditions

- Stop when two writers own the same file or generated output.
- Stop when a lane needs to edit outside its write scope.
- Stop when the base SHA or shared contract changes unexpectedly.
- Stop when dirty or untracked work has no owner.
- Stop on a migration, route, manifest, or lockfile collision.
- Stop when lane or post-integration verification fails.
- Stop when a handoff omits changed files, validation evidence, or known deviations.
- Collapse tightly coupled lanes into one sequential lane instead of pretending they are independent.
