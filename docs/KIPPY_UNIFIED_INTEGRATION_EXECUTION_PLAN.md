# Kippy unified-product integration plan

Status: executing
Integration owner: primary Codex thread
Approved: 2026-08-01

## Objective and terminal condition

Deliver one Kippy V2 product in Android Studio and on a physical QA device:
parental controls and WhatsApp safety operate together, and the guardian PWA
uses the same V2 contracts. Branding and non-blocking optimization are deferred.

The implementation phase is complete only when a clean Android Lab/QA build,
guardian web build and integrated device/browser smoke pass. Google Play is
not changed by this plan until a separate Internal Testing release gate.

## Verified baselines

| Repository / worktree | Branch | Base | State at start |
|---|---|---|---|
| `C:/Users/Racheli/Documents/kippy` | `agent/guardian-v2-real-qa` | `932023a` | local Live Lab plus untracked brand/skills preserved |
| `C:/tmp/KippySafetyCore-v2` | `codex/unified-safety-contract` | `f75e23d` | clean and remote-verified |

Existing changes are user-owned integration inputs. No lane may clean, stash,
reset, switch branches, stage or commit them.

## Dependency graph

```text
L0 product/contracts
  -> L1 backend contract integration
  -> L2 Android unified runtime ---------\
  -> L3 guardian unified experience ------> L4 integration + Android Studio QA
```

## Ownership

| Lane | Sole writer | Exact write scope |
|---|---|---|
| L0 / integration | primary thread | shared product docs, `src/App.tsx`, package/lock files, generated types, cross-lane glue |
| L1 backend | primary thread | canonical `supabase-v2/supabase/**` and ordered migrations |
| L2 Android | Android lane | `KippySafetyCore-v2/app/**`, `guardian/**`, Android build files when explicitly required |
| L3 guardian PWA | guardian lane | non-admin guardian pages/components/hooks/services and `e2e/**`; never `src/App.tsx` |

Unlisted files are read-only. Shared entrypoints and migrations are integrated
sequentially by the integration owner.

## Acceptance criteria

- One active V2 family/child/device identity and pairing flow.
- Android runs parental enforcement and WhatsApp capture in the same process
  without disabling either runtime.
- Guardian PWA exposes device health, controls and confirmed safety alerts from
  V2 APIs only.
- Lab observability shows canonical capture, FIFO, gate 1, gate 2, expert/dry
  run and alert outcome; voice adds correlation/decode/transcript stages.
- No child time requests, chores/rewards, competition or internal chat.
- No branding/pricing work in this integration.

## Integration queue

1. Freeze product and shared contracts.
2. Accept and inspect Android and guardian lane handoffs.
3. Integrate backend migrations/RPCs in dependency order.
4. Integrate Android and run focused unit/build checks.
5. Integrate guardian PWA and run typecheck/build/E2E.
6. Run the combined release gate and physical Android Studio QA.

## Stop conditions

- Two writers need the same file, migration, manifest or generated output.
- A lane touches an unassigned path or changes its base unexpectedly.
- A handoff omits its changed-file inventory or focused verification.
- A core function fails; non-blocking optimization and cosmetic debt are
  recorded for later and do not expand the current scope.
