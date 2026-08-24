---
name: kippy-release-gate
description: Verify Kippy changes before declaring implementation complete or preparing a commit, push, PR, merge, Lovable sync, deployment, or release. Use when asked whether work is ready, to run final checks, review the intended diff or staged files, prepare a verified handoff, or ship completed work. Discover the active repository's instructions, package manager, scripts, CI, and change-specific validation first; never invent checks or claim tests passed when dependencies, tests, CI, device evidence, or required access are missing.
---

# Kippy Release Gate

Treat verification as a target-specific gate. Do not mutate local or remote state unless the current request explicitly authorizes that action.

## Verdicts

Use exactly one verdict:

- `READY`: Every required applicable check ran and passed; scope and Git state are understood; no blocker remains.
- `READY_FOR_REVIEW`: Available checks passed, but release-grade proof is intentionally deferred and listed. Do not use this verdict to authorize merge, deployment, migration application, Lovable sync, or production release.
- `NOT_READY`: A check failed or the intended diff has a fixable problem.
- `BLOCKED`: Scope, authority, prerequisites, repository state, or external access prevents a trustworthy decision.

Never translate `NOT RUN`, `NOT FOUND`, or `BLOCKED` into "passed."

## Workflow

### 1. Establish the Gate Target

- Record one target: `completion`, `commit`, `push`, `PR`, `merge`, `Lovable sync`, `deployment`, or `release`.
- Identify the intended change and every repository in scope.
- Treat verification as read-only unless the requested state-changing action is explicit.

### 2. Capture the Git Baseline

- Resolve repository root, branch, HEAD, upstream, ahead or behind state, staged files, unstaged files, untracked files, conflicts, and in-progress Git operations.
- For completion or commit, review changes against `HEAD`.
- For PR or merge, use the user-specified base. Stop if no trustworthy base can be established.
- Preserve unrelated user and agent work.

### 3. Define the Intended Diff

- Inspect staged, unstaged, and relevant untracked content.
- Separate intended files from unrelated or generated files.
- Check both working-tree and staged diffs.
- Do not stage broad globs or all files as part of verification.

### 4. Discover Instructions and Checks

- Read applicable `AGENTS.md` files and repository release instructions.
- Inspect manifests, workspace configuration, declared package-manager fields, lockfiles, build and test configuration, CI workflows, and repository scripts.
- Resolve the package manager in this order: explicit project declaration, CI usage, repository instructions, then one unambiguous lockfile.
- If multiple lockfiles remain ambiguous, stop instead of choosing by preference.
- Search beyond a manifest script before concluding that tests or CI do not exist.
- Never invent missing scripts or hardcode tool versions.
- Do not install dependencies, alter lockfiles, deploy, invoke production functions, or incur external cost without authorization.

### 5. Review Safety and Release Hygiene

- Check for merge markers, malformed patches, unexpected binaries, accidental generated output, unrelated lockfile changes, and staged sensitive files.
- Inspect for credentials and private environment values without printing their contents.
- Identify migrations, RLS, authentication, device contracts, privacy, telemetry, and production configuration that require domain checks.
- For web or UI changes, ensure fixtures, screenshots, recordings, and design artifacts contain only synthetic data and do not expose real child, family, session, or production information.
- Never apply a migration or perform another production mutation merely to verify readiness.

### 6. Run Discovered Checks

- Run from the documented repository root using the repository-selected tool.
- Run cheap targeted checks first, then applicable lint, type or compile, tests, build, integration, and domain checks.
- Use exact repository-defined commands and existing dependencies.
- If a prerequisite is absent, record `NOT RUN - <reason>`.
- Record the exact command, exit result, and concise evidence.
- After a failure, skip dependent release actions; continue only independent read-only checks that improve the report.

For Supabase changes, confirm historical migrations were not edited without justification; review new migrations, RLS, grants, RPC compatibility, generated types, functions, and available project validation.

For Android changes, verify the actual Android repository and module; use declared Gradle wrapper tasks; review manifest, exported components, permissions, background behavior, device contracts, and affected variants. Do not claim device behavior was validated without emulator or device evidence.

For web or UI changes:

- Run the repository-declared Playwright or equivalent browser checks when present; do not replace them with an improvised command.
- Exercise affected routes at representative mobile and desktop viewports when a runnable local or approved staging target exists.
- Verify Hebrew and RTL direction, keyboard focus, touch-target usability, loading/empty/error states affected by the change, horizontal overflow, and page or console errors.
- Emulate reduced motion and confirm essential state changes remain understandable without relying on animation.
- Compare against an approved Figma or other design source when one is explicitly in scope, while preserving repository architecture and existing product contracts.
- Record automated E2E, browser interaction, screenshot review, and source-only inspection as different evidence types. If the browser, target, account, or test data is unavailable, record `NOT RUN - <reason>`.
- Use isolated test state and synthetic family or child data. Never run destructive flows against production merely to collect visual evidence.
- A web or UI change cannot receive `READY` without applicable targeted E2E and recorded RTL, reduced-motion, and visual-QA evidence. Record each affected route, state, viewport, method, and artifact reference. If any dimension is unavailable, record `NOT FOUND` or `NOT RUN - <reason>` and use `READY_FOR_REVIEW` or `BLOCKED` according to the gate target; source inspection or an informal manual claim is not a substitute.

### 7. Recheck Repository State

- Repeat the Git snapshot.
- Identify files created or modified by verification.
- Stop if HEAD, upstream, scope, or working-tree state changed unexpectedly.
- Review the final staged diff immediately before any authorized publication action.

### 8. Decide and Report

Use [the release report template](references/release-report-template.md).

For merge, Lovable sync, deployment, migration application, or release, missing relevant tests, CI evidence, environment access, or domain validation is `BLOCKED`, not `READY_FOR_REVIEW`.

Perform an explicitly authorized state-changing action only after `READY`.

## Stop Conditions

- Stop when the target, repository, intended scope, or comparison base cannot be established.
- Stop on merge conflicts, unresolved Git operations, or unsafe branch state.
- Stop when unrelated changes overlap files that would be staged, modified, or published.
- Stop when sensitive content may be committed or exposed.
- Stop when package-manager or command selection remains ambiguous.
- Stop when a required check fails or cannot run.
- Stop when verification unexpectedly changes source, lockfiles, generated artifacts, HEAD, upstream, or the intended diff.
- Stop before unapproved migration, deployment, production invocation, external cost, or remote write.
- Stop when the next action exceeds the current request's explicit authority.
