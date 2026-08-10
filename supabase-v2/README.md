# Kippy V2 Supabase workdir

This directory is the canonical Supabase CLI workdir for the clean Kippy V2
project. It is intentionally separate from the repository-root `supabase/`
directory, whose 205 legacy migrations do not belong to the linked V2 history.

## Migration history

- `20260727150000` through `20260810150000`: the 48 migrations already recorded
  by linked `kippy-v2-staging`.
- `20260810160000_cmo_marketing_foundation.sql`: the next local migration under
  review. It has not been applied to the linked project.
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

Expected pre-apply state:

- 48 matched migrations;
- 0 remote-only migrations;
- only `20260810160000_cmo_marketing_foundation.sql` local-only;
- dry-run lists only that migration.

## Disposable runtime contract

`supabase/tests/cmo_marketing_foundation_contract.sql` is destructive test SQL
for a disposable database only. It uses synthetic principals and rolls back its
fixtures. Apply the 48-migration baseline and the pending CMO migration first,
then execute the contract with `psql -v ON_ERROR_STOP=1`.

Never run the contract against linked staging or production.
