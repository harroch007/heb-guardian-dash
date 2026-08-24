# Parallel Plan and Handoff Templates

## Parallel Work Plan

- Objective:
- Terminal condition:
- Repositories:
- Base branches and SHAs:
- Existing changes and owner:
- Execution model: `<dedicated worktrees | shared checkout>`
- Integration owner:
- Global verification:

### Dependency Graph

```text
<L0 contract> -> <L1 backend> -> <L3 integration>
              -> <L2 frontend> -> <L3 integration>
```

### Shared Contracts

| Contract or artifact | Sole writer | Consumers | Freeze condition |
|---|---|---|---|
|  |  |  |  |

### Work Lanes

| Lane | Mode / writer | Depends on | Exact write scope | Read-only inputs | Deliverable | Verification |
|---|---|---|---|---|---|---|
| L0 | READ_ONLY / WRITER / INTEGRATOR | — | `<paths/globs>` | `<paths>` |  |  |

Unlisted paths are read-only.

### Integration Queue

1. Integrate `<lane>`.
   - Confirm handoff completeness.
   - Confirm diff stays within ownership.
   - Run `<checks>`.
   - Record checkpoint.
2. Integrate `<next lane>` and repeat.

### Stop Conditions

- `<Task-specific stop condition>`
- Ownership, contract, base, or verification drift.
- Any required cross-scope edit before explicit re-planning.

## Lane Handoff

- Lane:
- Status: `<ready | partial | blocked>`
- Objective:
- Repository, branch, and base SHA:
- Artifact: `<commit SHA, patch, or shared-checkout diff>`
- Assigned write scope:
- Files changed and reason:
- Contracts produced or consumed:
- Decisions made:
- Verification commands and results:
- Deviations from plan:
- Known failures and risks:
- Downstream impact:
- Merge prerequisites:
- Recommended integration position:
- Outside-scope confirmation:
- Uncommitted or hidden work:
