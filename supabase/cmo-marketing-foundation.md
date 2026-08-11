# CMO marketing foundation

`20260810160000_cmo_marketing_foundation.sql` is a V2-native, staging-first
foundation for Kippy's pre-launch waitlist and internal marketing control tower.
It does not connect a provider, publish content, or create a spend path.

The canonical V2 migration history is under `supabase-v2/supabase/migrations`.
The copy under the repository-root `supabase/migrations` is retained as a
transition mirror and is verified byte-for-byte by the static validator. It is
archival only, is intentionally not a complete V2 sequence, and must never be
used as a `db push` deployment target for the unrelated legacy project.

## Access model

- The V2 waitlist RPC is executable only by `service_role` and is reserved for
  a trusted Edge/WAF gateway. Browser roles cannot invoke it directly.
- Accepted, duplicate, invalid, and limited waitlist submissions return opaque
  acknowledgements. Server-secret HMAC buckets limit repeated email and phone
  identities, a higher global circuit breaker bounds aggregate abuse, stale
  buckets are opportunistically pruned, and the consent notice version is
  server-owned.
- The database limits are defense-in-depth; do not open the RPC to browser roles
  or launch the V2 form without trusted request-layer rate limiting and bot
  verification.
- The waitlist table, private rate secret, rate buckets, and all eight
  `v2_cmo_*` tables have RLS enabled and no direct API-role grants.
- Staff RPCs call `v2_admin_current_staff_principal()` and
  `v2_admin_has_permission(...)`; the existing V2 staff boundary supplies the
  active staging principal and AAL2 requirement.
- `ceo` receives read, manage, approve, publication-intent, and audit access.
  `growth_product_data` receives read/manage. `auditor` receives read/audit.
- Approval and publication-intent permissions remain CEO-only in this seed.

## Staff RPC surface

- `v2_cmo_create_campaign_brief`
- `v2_cmo_create_content_item`
- `v2_cmo_record_claim_review`
- `v2_cmo_request_content_approval`
- `v2_cmo_decide_content_approval`
- `v2_cmo_create_publication_intent`
- `v2_cmo_list_pending_approvals`

Publication jobs are reviewable intents. No RPC in this migration can mark a
job published or call Meta. Content changes invalidate prior claims review,
cancel approvals and publication intents, and return the item to policy review.
Claim references are part of the hash-covered content: claim review verifies
that submitted references exactly match the stored references and never mutates
them. A mismatch returns `claim_refs_mismatch_for_content_hash`.

## Apply prerequisites and validation

The 52 applied V2 migrations are reconciled into the dedicated `supabase-v2`
workdir without modifying or deleting the 205 legacy migrations. Two
forward-only migrations are pending there: the admin-audit repair and the
privacy hardening. Do not run V2
migration commands from the repository-root `supabase` directory. Do not use
`migration repair` or `db pull` to bridge the unrelated histories.

After history reconciliation, validate in a disposable/local database first:

1. Run migration commands with `--workdir supabase-v2` and confirm dry-run lists
   only `20260811110000_v2_admin_write_audit_event_ambiguity_fix.sql` and
   `20260811120000_v2_privacy_contract_hardening.sql`.
2. Regenerate `src/integrations/supabase/v2-types.ts` from the validated target.
3. Verify only `service_role` can execute the waitlist RPC, browser roles cannot
   invoke it, and API roles cannot select signup, rate-limit, or secret tables.
4. Verify staff RPCs reject no-session, non-AAL2, and missing-permission callers.
5. Exercise claim review, approval, hash invalidation, idempotency conflict, and
   append-only audit rejection inside transactions.
6. Run the admin-audit, shadow-privacy, CMO, and ephemeral contracts, then
   re-run database lint and the public-route Playwright suite.

## Rollback posture

This is a forward-only foundation. Before live data exists, rollback may be a
reviewed follow-up migration that revokes RPCs and removes the new objects in
dependency order. After any waitlist or audit data exists, do not drop tables;
ship a forward migration that disables entry points, preserves evidence, and
corrects the contract.
