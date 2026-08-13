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

SQL files under `supabase/tests/` are destructive contracts for a disposable
database only. They use synthetic principals and roll back their fixtures. Apply
the full 52-migration baseline first, then execute the relevant contract with
`psql -v ON_ERROR_STOP=1`.

Never run the contract against linked staging or production.
