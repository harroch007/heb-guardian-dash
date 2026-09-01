# Kippy V2 Supabase workdir

This directory is the canonical Supabase CLI workdir and backend source for the
clean Kippy V2 project. It is intentionally separate from the repository-root
`supabase/` directory, whose 205 legacy migrations do not belong to the linked
V2 history. V2 migrations, service RPCs and Edge Functions are owned here.

## Migration history

- `20260727150000` through `20260831161000`: all 61 migration versions recorded
  by linked `kippy-v2-staging` are represented locally. The two monitoring push
  migrations were applied during the approved dormant deployment on 2026-08-31.
- `20260831230000_v2_monitoring_push_activation_readiness.sql` is the sole
  forward-only local migration pending independent review. It adds no cron job,
  capability, Vault value, endpoint, secret, or feature activation.
- The six `20260816*` through `20260826170000` sources were reconciled from the
  published `codex/supabase-v2-publication` lineage.
- `20260828100000_v2_ephemeral_privacy_v3.sql` was recovered from the immutable
  source introduced by KippySafetyCore commit `b896ed9`; the file is unchanged
  in the remote-verified recovery branch and represents the linked migration's
  stored statement sequence.
- The 43 formerly remote-only files were reconciled against the remote migration
  ledger. Stored statements matched in order; zero-statement ledger entries were
  corroborated against the live schema and matching local source copies.
- Linked staging also exposes 11 WhatsApp-canary objects whose DDL is not present
  in the reconciled pre-monitoring 59-file history. The checked-in `v2-types.ts`
  preserves that linked
  surface while adding the locally validated pending schema. Their migration
  provenance remains a separate reconciliation item; do not rewrite historical
  migration blobs to absorb it.

The 62 migration files in `supabase-v2/supabase/migrations/` are the current
local source of truth for V2: 61 form the deployed staging baseline and one is
pending review. Do not run V2 migration commands from the repository-root
`supabase/` directory, and do not use `migration repair` or `db pull` to bridge
the two histories.

## Deployed Edge Function sources

The last full source-reconciliation snapshot for 21 active non-legacy functions
is captured under:

```text
supabase/deployed-sources/gscclrgcmvtbyquveoze/
```

That snapshot predates the separately approved dormant deployment of
`v2-deliver-monitoring-push` version 1. It remains authoritative for the
deployed `v2-get-push-config` version 36 source inspected by this readiness
work; refresh the full manifest in a separate read-only provenance step before
release. The project contains multiple deployed versions of five `_shared`
paths. The snapshots therefore remain isolated per function and version instead
of being flattened into a synthetic shared tree. `manifest.json` records each
provider bundle hash and JWT setting.

The active legacy `check-device-health` deployment is recorded as an explicit
exclusion. Its source is not part of the canonical V2 backend and must not be
modified, promoted, or redeployed from this workdir.

The snapshots are immutable deployment evidence. New or intentionally changed
function source belongs in `supabase/functions/` and must be reviewed against
the matching snapshot before deployment.

## Safe verification

Link state lives in `supabase/.temp/` and is ignored by Git. After linking this
workdir to the reviewed staging project, verify without applying:

```powershell
supabase migration list --linked --workdir supabase-v2
supabase db push --linked --dry-run --workdir supabase-v2
```

Expected linked state while this activation-readiness patch is under review:

- 61 matched migrations;
- 0 remote-only migrations;
- 1 local-only migration: `20260831230000`;
- dry-run reports exactly that activation-readiness migration and nothing else.

The 2026-08-31 source-reconciliation pass ran `migration list` only. It did not
run `db push`, `db pull`, `migration repair`, deploy a function, or mutate the
linked project.

## Disposable runtime contract

Contract files under `supabase/tests/` are destructive tests for a disposable
database only. They use synthetic principals and remove or roll back their
fixtures. Apply the full 62-migration local history first, then execute SQL
contracts with `psql -v ON_ERROR_STOP=1`.

The real two-connection publication-intent, lease, and activation-cutoff race
contracts require
`psql` on `PATH` and a password supplied through the normal libpq environment.
They refuse non-loopback hosts and sanitize their output; the lease contract
also never prints the lease token. A loopback proxy or SSH tunnel does not make
a remote database disposable; never point either test at one:

```powershell
$env:PGPASSWORD = 'postgres'
try {
  python -B supabase-v2/supabase/tests/v2_cmo_publication_intent_race_contract.py `
    --port 54322 `
    --confirm-disposable-local
  python -B supabase-v2/supabase/tests/v2_ephemeral_lease_race_contract.py `
    --port 54322 `
    --confirm-disposable-local
  python -B supabase-v2/supabase/tests/v2_monitoring_push_device_lease_race_contract.py `
    --port 54322 `
    --confirm-disposable-local
  python -B supabase-v2/supabase/tests/v2_monitoring_push_activation_cutoff_race_contract.py `
    --port 54322 `
    --confirm-disposable-local
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
```

Never run the contract against linked staging or production.
