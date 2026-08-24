---
name: kippy-sync-project-status
description: Establish and report Kippy's evidence-backed current project state. Use when resuming Kippy work, taking over from another agent or Codex thread, asking where development stands, validating a handoff, checking whether work is local, committed, or pushed, locating the React/Supabase and Android repositories, or establishing a safe baseline before parallel planning. Distinguish verified repository facts from unshared conversation context, preserve uncommitted work, and label missing repositories or unrun checks as unknown rather than inferred.
---

# Synchronize Kippy Project Status

Create a read-only status snapshot. Separate confirmed facts, local-only state, inferences, and unknowns.

## Workflow

1. Establish repository scope.
   - Record the workspace path, Git root, repository identity, branch, and HEAD.
   - Treat the current repository as the React/Supabase repository only when its files prove that identity.
   - Look for Android markers such as `settings.gradle`, `build.gradle`, and `AndroidManifest.xml`.
   - If Android is absent from the inspected scope, report it as not located. Do not infer that it does not exist elsewhere, and do not scaffold it.

2. Inspect Git without changing it.
   - Inspect status, tracked modifications, untracked files, recent commits, remotes, upstream state, and worktrees.
   - Preserve every local change. Do not stage, stash, clean, reset, checkout, commit, or rewrite files.
   - Distinguish remote-verified commits, local commits, tracked modifications, and untracked files.
   - Claim that a branch matches its remote only after current remote verification. Otherwise report the remote state as unverified.

3. Inspect only relevant project evidence.
   - Read targeted source-of-truth documents, package scripts, feature flags, Supabase configuration and migrations, and linked handoff files.
   - Prefer targeted discovery and search over broad repository reading.
   - Do not infer that build, lint, tests, deployment, or device behavior passes from configuration or script existence.
   - Run checks only when necessary, safe, and feasible; record the exact command and result.

4. Reconcile agent and thread context.
   - Treat files, Git history, command output, and supplied handoffs as evidence.
   - Treat claims that exist only in another Codex thread as unavailable until persisted or supplied.
   - Never claim synchronization with another agent merely because both agents use the same workspace.
   - Do not steer another thread unless the user asks.
   - If referenced work cannot be found, request its repository path, branch, HEAD, working-tree state, completed work, in-progress work, blocker, and next action.

5. Report using [the status template](references/status-report-template.md).
   - Include paths and short commit SHAs where useful.
   - Cite the file or command supporting each material claim.
   - Use `not checked`, `not located`, or `unverified` instead of guessing.
   - End with the single safest next action.

## Stop Conditions

- Stop before any operation that changes files, the index, Git history, branches, remotes, databases, deployments, or external services. This skill grants read-only authority.
- Stop before reading or printing secret values. Report only that secret-bearing configuration exists or is missing.
- If local changes overlap a proposed follow-on edit, finish the report and request direction before modifying them.
- If the Android repository is not proven by files or a supplied path, mark it as not located and do not create one.
- If network, credentials, or the remote is unavailable, mark remote state as unverified.
- If another thread's work is not persisted in accessible evidence, request a handoff and do not reconstruct it from assumptions.
