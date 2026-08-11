# Kippy V2 Supabase workdir

This directory is the canonical Supabase CLI workdir for the clean Kippy V2
project. It is intentionally separate from the repository-root `supabase/`
directory, whose 205 legacy migrations do not belong to the linked V2 history.

## Migration history

- `20260727150000` through `20260810211000`: all 52 migrations are recorded by
  linked `kippy-v2-staging`.
- The 43 formerly remote-only files were reconciled against the remote migration
  ledger. Stored statements matched in order; zero-statement ledger entries were
  corroborated against the live schema and matching local source copies.

The migration files in `supabase/migrations/` are the source of truth for V2.
Do not run V2 migration commands from the repository-root `supabase/` directory,
and do not use `migration repair` or `db pull` to bridge the two histories.

## Safe verification

Link state lives in `supabase/.temp/` and is ignored by Git. After linking this
workdir to the reviewed staging project, verify without applying:

```powershell
supabase migration list --linked --workdir supabase-v2
supabase db push --linked --dry-run --workdir supabase-v2
```

Expected linked state:

- 52 matched migrations;
- 0 remote-only migrations;
- 0 local-only migrations;
- dry-run reports no pending migrations.

## Disposable runtime contract

Contract files under `supabase/tests/` are destructive tests for a disposable
database only. They use synthetic principals and remove their fixtures. Apply
the full 52-migration baseline first, then execute SQL contracts with
`psql -v ON_ERROR_STOP=1`.

The real two-connection lease race contract requires `psql` on `PATH` and a
password supplied through the normal libpq environment. It refuses non-loopback
hosts and does not print the lease token. A loopback proxy or SSH tunnel does
not make a remote database disposable; never point this test at one:

```powershell
$env:PGPASSWORD = 'postgres'
try {
  python -B supabase-v2/supabase/tests/v2_ephemeral_lease_race_contract.py `
    --port 54322 `
    --confirm-disposable-local
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
```

Never run the contract against linked staging or production.
