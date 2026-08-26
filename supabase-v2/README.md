# Kippy V2 Supabase workdir

This directory is the canonical Supabase CLI workdir and backend source for the
clean Kippy V2 project. It is intentionally separate from the repository-root
`supabase/` directory, whose 205 legacy migrations do not belong to the linked
V2 history. V2 migrations, service RPCs and Edge Functions are owned here.

## Migration history

- `20260727150000` through `20260810211000`: all 52 migrations are recorded by
  linked `kippy-v2-staging`.
- `20260816090000` and `20260816103000` are deployed historical migrations
  reconciled byte-for-byte from `codex/phase2-whatsapp-text`; their stored
  statement sequences match linked staging.
- `20260816110000` is a forward-only local repair for the admin audit helper.
  It is pending and has not been applied to linked staging; its audit snapshot
  includes only active, scope-applicable permissions.
- `20260816120000` is a forward-only privacy hardening for the shadow-result
  and edge-gated waitlist boundaries. It is pending and has not been applied
  to linked staging.
- `20260816130000` is a forward-only atomic idempotency repair for concurrent
  publication-intent calls. It is pending and has not been applied to linked
  staging.
- `20260826170000` adds the default-off, service-owned and per-device private
  text P0 activation contract. It is pending and has not been applied.
- The 43 formerly remote-only files were reconciled against the remote migration
  ledger. Stored statements matched in order; zero-statement ledger entries were
  corroborated against the live schema and matching local source copies.
- Linked staging also exposes 11 WhatsApp-canary objects whose DDL is not present
  in this 58-file history. The checked-in `v2-types.ts` preserves that linked
  surface while adding the locally validated pending schema. Their migration
  provenance remains a separate reconciliation item; do not rewrite historical
  migration blobs to absorb it.

The 58 migration files in `supabase-v2/supabase/migrations/` are the source of
truth for V2. Do not run V2 migration commands from the repository-root
`supabase/` directory, and do not use `migration repair` or `db pull` to bridge
the two histories.

## Safe verification

Link state lives in `supabase/.temp/` and is ignored by Git. After linking this
workdir to the reviewed staging project, verify without applying:

```powershell
supabase migration list --linked --workdir supabase-v2
supabase db push --linked --dry-run --workdir supabase-v2
```

Expected linked state:

- 54 matched migrations;
- 0 remote-only migrations;
- 4 local-only migrations (`20260816110000`, `20260816120000`,
  `20260816130000`, `20260826170000`);
- dry-run reports exactly those four migrations as pending.

## Disposable runtime contract

Contract files under `supabase/tests/` are destructive tests for a disposable
database only. They use synthetic principals and remove their fixtures. Apply
the full 58-migration baseline first, then execute SQL contracts with
`psql -v ON_ERROR_STOP=1`.

The real two-connection publication-intent and lease race contracts require
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
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
```

Never run the contract against linked staging or production.
