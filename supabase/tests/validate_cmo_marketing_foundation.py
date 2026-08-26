from pathlib import Path
import re


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "migrations"
    / "20260810160000_cmo_marketing_foundation.sql"
)
CANONICAL_MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "supabase-v2"
    / "supabase"
    / "migrations"
    / MIGRATION.name
)
RUNTIME_CONTRACT = (
    Path(__file__).resolve().parents[2]
    / "supabase-v2"
    / "supabase"
    / "tests"
    / "cmo_marketing_foundation_contract.sql"
)
HARDENING_MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "supabase-v2"
    / "supabase"
    / "migrations"
    / "20260810194000_cmo_rpc_execute_hardening.sql"
)


def require(sql: str, fragment: str) -> None:
    if fragment.lower() not in sql.lower():
        raise AssertionError(f"missing required migration fragment: {fragment}")


def forbid(sql: str, fragment: str) -> None:
    if fragment.lower() in sql.lower():
        raise AssertionError(f"forbidden migration fragment present: {fragment}")


def function_body(sql: str, function_name: str) -> str:
    match = re.search(
        rf"create or replace function public\.{re.escape(function_name)}\b.*?\n\$\$;",
        sql,
        re.I | re.S,
    )
    if match is None:
        raise AssertionError(f"missing function body: {function_name}")
    return match.group(0)


def main() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    if not CANONICAL_MIGRATION.is_file():
        raise AssertionError(f"missing canonical V2 migration: {CANONICAL_MIGRATION}")
    if CANONICAL_MIGRATION.read_bytes() != MIGRATION.read_bytes():
        raise AssertionError("legacy-root CMO migration differs from canonical V2 migration")
    if not RUNTIME_CONTRACT.is_file():
        raise AssertionError(f"missing runtime contract: {RUNTIME_CONTRACT}")
    if not HARDENING_MIGRATION.is_file():
        raise AssertionError(f"missing RPC hardening migration: {HARDENING_MIGRATION}")

    require(sql, "begin;")
    require(sql, "commit;")
    require(sql, "v2_admin_foundation_required")
    require(sql, "v2_submit_marketing_waitlist")
    require(sql, "grant execute on function public.v2_submit_marketing_waitlist")
    require(sql, "to anon, authenticated")
    require(sql, "v2_cmo_require_permission")
    require(sql, "marketing.approve")
    require(sql, "marketing.publish_intent")
    require(sql, "v2_cmo_content_change_guard")
    require(sql, "v2_cmo_publication_integrity_guard")
    require(sql, "v2_cmo_audit_events_keep_append_only")

    claim_review = function_body(sql, "v2_cmo_record_claim_review")
    require(claim_review, "for update")
    require(claim_review, "claim_refs_mismatch_for_content_hash")
    require(claim_review, "content_row.claim_refs is distinct from target_claim_refs")
    forbid(claim_review, "set claim_gate_result = target_claim_gate_result,\n           claim_refs = target_claim_refs")

    runtime_contract = RUNTIME_CONTRACT.read_text(encoding="utf-8")
    require(runtime_contract, "claim_refs_mismatch_for_content_hash")
    require(runtime_contract, "PASS claim review is verification-only")
    require(runtime_contract, "anon_cmo_execute_grant_present")
    require(runtime_contract, "pending_approvals_rpc_must_be_volatile")

    hardening_sql = HARDENING_MIGRATION.read_text(encoding="utf-8")
    require(hardening_sql, "from public, anon, service_role")
    require(hardening_sql, "to authenticated")
    require(hardening_sql, "alter function public.v2_cmo_list_pending_approvals(integer) volatile")

    cmo_tables = re.findall(r"create table public\.(v2_cmo_[a-z_]+)", sql, re.I)
    expected_tables = {
        "v2_cmo_campaign_briefs",
        "v2_cmo_content_items",
        "v2_cmo_creative_assets",
        "v2_cmo_approval_requests",
        "v2_cmo_publication_jobs",
        "v2_cmo_experiments",
        "v2_cmo_metric_snapshots",
        "v2_cmo_audit_events",
    }
    if set(map(str.lower, cmo_tables)) != expected_tables:
        raise AssertionError(f"unexpected CMO table set: {sorted(cmo_tables)}")

    for table in expected_tables | {"v2_marketing_waitlist_signups"}:
        require(sql, f"alter table public.{table} enable row level security")
        require(sql, f"revoke all on table public.{table} from public, anon, authenticated")

    forbid(sql, "public.waitlist_signups")
    forbid(sql, "references auth.users")
    forbid(sql, "public.is_admin")
    forbid(sql, "create policy")
    forbid(sql, "grant insert on")
    forbid(sql, "grant update on")
    forbid(sql, "grant delete on")
    forbid(sql, "grant select on")

    print("CMO V2 migration static contract: PASS")


if __name__ == "__main__":
    main()
