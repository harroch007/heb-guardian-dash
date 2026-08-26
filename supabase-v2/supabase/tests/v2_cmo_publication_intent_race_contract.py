#!/usr/bin/env python3
"""Real two-connection publication-intent race contract for disposable local V2."""

from __future__ import annotations

import argparse
import ipaddress
import os
import re
import secrets
import shutil
import subprocess
import sys
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path


EXPECTED_MIGRATION_COUNT = 58
EXPECTED_FIRST_MIGRATION = "20260727150000"
EXPECTED_LAST_MIGRATION = "20260826170000"
CONTENT_HASH = "a" * 64
RESULT_PATTERN = re.compile(r"^RESULT\|")


class ContractError(RuntimeError):
    """Raised when the disposable race contract is not satisfied."""


@dataclass(frozen=True)
class Fixture:
    auth_user_id: uuid.UUID
    principal_id: uuid.UUID
    assignment_id: uuid.UUID
    brief_id: uuid.UUID
    content_id: uuid.UUID
    approval_id: uuid.UUID
    principal_key: str
    identical_key: str
    conflict_key: str


@dataclass(frozen=True)
class WorkerResult:
    channel: str
    outcome: str
    job_id: str | None
    sqlstate: str
    message: str


class Psql:
    def __init__(
        self,
        executable: str,
        host: str,
        port: int,
        user: str,
        database: str,
    ) -> None:
        self._base_args = [
            executable,
            "-X",
            "-q",
            "-A",
            "-t",
            "-F",
            "|",
            "-w",
            "-h",
            host,
            "-p",
            str(port),
            "-U",
            user,
            "-d",
            database,
            "-v",
            "ON_ERROR_STOP=1",
            "-v",
            "VERBOSITY=verbose",
        ]

    @staticmethod
    def _environment(application_name: str | None = None) -> dict[str, str]:
        environment = os.environ.copy()
        if application_name:
            environment["PGAPPNAME"] = application_name
        return environment

    def run(
        self,
        sql: str,
        *,
        application_name: str | None = None,
        timeout: float = 30,
    ) -> str:
        result = subprocess.run(
            [*self._base_args, "-c", sql],
            capture_output=True,
            text=True,
            timeout=timeout,
            env=self._environment(application_name),
            check=False,
        )
        if result.returncode != 0:
            detail = (result.stderr or result.stdout).strip()
            raise ContractError(f"psql exited {result.returncode}: {detail}")
        return result.stdout

    def rows(self, sql: str, *, timeout: float = 30) -> list[str]:
        return [
            line.strip()
            for line in self.run(sql, timeout=timeout).splitlines()
            if line.strip()
        ]

    def scalar(self, sql: str, *, timeout: float = 30) -> str:
        rows = self.rows(sql, timeout=timeout)
        if len(rows) != 1:
            raise ContractError(f"expected one scalar row, received {len(rows)}")
        return rows[0]

    def popen(self, sql: str, *, application_name: str) -> subprocess.Popen[str]:
        return subprocess.Popen(
            [*self._base_args, "-c", sql],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=self._environment(application_name),
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Run two real caller connections against a disposable local "
            "58-migration Kippy V2 database."
        )
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--database", default="postgres")
    parser.add_argument("--psql", default="psql")
    parser.add_argument("--barrier-seconds", type=float, default=8)
    parser.add_argument("--winner-hold-seconds", type=float, default=4)
    parser.add_argument(
        "--confirm-disposable-local",
        action="store_true",
        help="Confirm that the loopback target may receive committed fixtures.",
    )
    args = parser.parse_args()
    if not args.confirm_disposable_local:
        parser.error("--confirm-disposable-local is required")
    if args.barrier_seconds < 5:
        parser.error("--barrier-seconds must be at least 5")
    if not 2 <= args.winner_hold_seconds <= 15:
        parser.error("--winner-hold-seconds must be between 2 and 15")
    return args


def resolve_psql(value: str) -> str:
    candidate = Path(value)
    if candidate.is_file():
        return str(candidate.resolve())
    resolved = shutil.which(value)
    if not resolved:
        raise ContractError(f"psql executable not found: {value}")
    return resolved


def require_loopback(host: str) -> None:
    if host.lower() == "localhost":
        return
    try:
        address = ipaddress.ip_address(host.strip("[]"))
    except ValueError as error:
        raise ContractError(f"refusing non-IP database host: {host}") from error
    if not address.is_loopback:
        raise ContractError(f"refusing non-loopback database host: {host}")


def new_fixture() -> Fixture:
    run_id = uuid.uuid4().hex
    return Fixture(
        auth_user_id=uuid.uuid4(),
        principal_id=uuid.uuid4(),
        assignment_id=uuid.uuid4(),
        brief_id=uuid.uuid4(),
        content_id=uuid.uuid4(),
        approval_id=uuid.uuid4(),
        principal_key=f"cmo-race-{run_id}",
        identical_key=f"cmo-race-identical-{run_id}",
        conflict_key=f"cmo-race-conflict-{run_id}",
    )


def canonical_migration_versions() -> list[str]:
    migration_directory = Path(__file__).resolve().parent.parent / "migrations"
    versions: list[str] = []
    for migration_path in sorted(migration_directory.glob("*.sql")):
        match = re.fullmatch(r"(\d{14})_.+\.sql", migration_path.name)
        if not match:
            raise ContractError(
                f"unexpected canonical migration filename: {migration_path.name}"
            )
        versions.append(match.group(1))
    if len(versions) != EXPECTED_MIGRATION_COUNT:
        raise ContractError(
            f"expected {EXPECTED_MIGRATION_COUNT} canonical migrations, "
            f"found {len(versions)}"
        )
    if len(set(versions)) != len(versions):
        raise ContractError("canonical migration versions are not unique")
    return versions


def verify_baseline(psql: Psql) -> None:
    expected_versions = canonical_migration_versions()
    applied_versions = psql.rows(
        "select version from supabase_migrations.schema_migrations order by version;"
    )
    if applied_versions != expected_versions:
        raise ContractError("local migration ledger differs from canonical migrations")
    if (
        applied_versions[0] != EXPECTED_FIRST_MIGRATION
        or applied_versions[-1] != EXPECTED_LAST_MIGRATION
    ):
        raise ContractError("canonical migration endpoints are unexpected")

    rpc_contract = psql.scalar(
        "select p.prosecdef, p.provolatile, "
        "exists (select 1 from unnest(p.proconfig) setting "
        "where setting = 'search_path=\"\"'), "
        "has_function_privilege('authenticated', p.oid, 'EXECUTE'), "
        "has_function_privilege('anon', p.oid, 'EXECUTE'), "
        "has_function_privilege('service_role', p.oid, 'EXECUTE') "
        "from pg_proc p where p.oid = "
        "'public.v2_cmo_create_publication_intent"
        "(text,uuid,text,uuid,text,text,timestamptz)'::regprocedure;"
    )
    if rpc_contract != "t|v|t|t|f|f":
        raise ContractError(f"unexpected publication RPC contract: {rpc_contract}")

    permission_contract = psql.scalar(
        "select exists ("
        "select 1 from public.v2_staff_roles role "
        "join public.v2_staff_role_permissions permission "
        "on permission.role_key = role.role_key "
        "where role.role_key = 'ceo' and role.is_active "
        "and permission.permission_key = 'marketing.publish_intent');"
    )
    if permission_contract != "t":
        raise ContractError("active CEO publication permission is missing")

    cleanup_contract = psql.scalar(
        "select pg_get_userbyid(class.relowner) = current_user, "
        "role.rolbypassrls, "
        "exists (select 1 from pg_trigger trigger "
        "where trigger.tgrelid = class.oid "
        "and trigger.tgname = 'v2_cmo_audit_events_keep_append_only' "
        "and trigger.tgenabled = 'O') "
        "from pg_class class join pg_roles role on role.rolname = current_user "
        "where class.oid = 'public.v2_cmo_audit_events'::regclass;"
    )
    if cleanup_contract != "t|t|t":
        raise ContractError("caller cannot perform exact disposable fixture cleanup")
    role_contract = psql.scalar(
        "begin; set transaction isolation level read committed; "
        "set local role authenticated; "
        "select current_user || '|' || current_setting('transaction_isolation'); "
        "rollback;"
    )
    if role_contract != "authenticated|read committed":
        raise ContractError(f"unexpected caller role contract: {role_contract}")

    print(
        f"LOCAL_BASELINE={len(applied_versions)}|{applied_versions[0]}|"
        f"{applied_versions[-1]}"
    )


def setup_fixture(psql: Psql, fixture: Fixture) -> None:
    psql.run(
        f"""
begin;
insert into auth.users (id) values ('{fixture.auth_user_id}');
insert into public.v2_admin_principals (
    id, principal_type, principal_key, display_name, environment, status
) values (
    '{fixture.principal_id}', 'staff', '{fixture.principal_key}',
    'CMO publication race contract', 'staging', 'active'
);
insert into public.v2_staff_profiles (principal_id, auth_user_id)
values ('{fixture.principal_id}', '{fixture.auth_user_id}');
insert into public.v2_staff_role_assignments (
    id, staff_principal_id, role_key, environment, scope_type, scope_key,
    granted_by_principal_id, reason_code
) values (
    '{fixture.assignment_id}', '{fixture.principal_id}', 'ceo', 'staging',
    'global', null, '{fixture.principal_id}',
    'cmo-publication-race-contract'
);
insert into public.v2_cmo_campaign_briefs (
    id, objective, audience, launch_stage, channel, hypothesis,
    single_cta, owner_principal_id, status
) values (
    '{fixture.brief_id}', 'Synthetic race objective',
    'Synthetic race audience', 'PRELAUNCH', 'WEBSITE',
    'Synthetic race hypothesis', 'Join updates',
    '{fixture.principal_id}', 'APPROVED'
);
insert into public.v2_cmo_content_items (
    id, brief_id, format, copy_json, creative_refs, claim_refs, utm,
    claim_gate_result, claim_reviewed_at, claim_reviewed_by, content_hash,
    owner_principal_id, status
) values (
    '{fixture.content_id}', '{fixture.brief_id}', 'race-copy',
    '{{"headline":"Synthetic publication race fixture"}}'::jsonb,
    '[]'::jsonb, '["synthetic-claim"]'::jsonb, '{{}}'::jsonb,
    'PASS', now(), '{fixture.principal_id}', '{CONTENT_HASH}',
    '{fixture.principal_id}', 'APPROVED'
);
insert into public.v2_cmo_approval_requests (
    id, resource_type, resource_id, content_hash, preview, risk,
    source_versions, launch_stage, claim_review_result, unresolved_risks,
    requested_by, requested_at, expires_at, status, decided_by, decided_at,
    decision_note
) values (
    '{fixture.approval_id}', 'CONTENT_ITEM', '{fixture.content_id}',
    '{CONTENT_HASH}', '{{"summary":"Synthetic approved fixture"}}'::jsonb,
    'LOW', '{{}}'::jsonb, 'PRELAUNCH', 'PASS', '[]'::jsonb,
    '{fixture.principal_id}', now() - interval '1 minute',
    now() + interval '2 hours', 'APPROVED', '{fixture.principal_id}',
    now(), 'Synthetic race approval'
);
commit;
"""
    )


def worker_sql(
    fixture: Fixture,
    advisory_key: int,
    channel: str,
    idempotency_key: str,
    hold_seconds: float,
) -> str:
    return f"""
begin;
set transaction isolation level read committed;
create function pg_temp.capture_publication_intent()
returns table (
    outcome text,
    returned_job_id uuid,
    error_sqlstate text,
    error_message text
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
    begin
        returned_job_id := public.v2_cmo_create_publication_intent(
            'CONTENT_ITEM',
            '{fixture.content_id}',
            '{channel}',
            '{fixture.approval_id}',
            '{CONTENT_HASH}',
            '{idempotency_key}',
            null
        );
        outcome := 'success';
        error_sqlstate := '00000';
        error_message := '';
    exception when others then
        returned_job_id := null;
        outcome := 'error';
        get stacked diagnostics
            error_sqlstate = returned_sqlstate,
            error_message = message_text;
    end;
    return next;
end;
$$;
set local role authenticated;
set local "request.jwt.claim.sub" = '{fixture.auth_user_id}';
set local "request.jwt.claims" =
    '{{"sub":"{fixture.auth_user_id}","aal":"aal2"}}';
select pg_advisory_xact_lock_shared({advisory_key}::bigint);
select 'RESULT|' || outcome || '|' || coalesce(returned_job_id::text, '')
       || '|' || error_sqlstate || '|' || error_message
  from pg_temp.capture_publication_intent();
select pg_sleep({hold_seconds});
commit;
"""


def wait_until(predicate: Callable[[], bool], timeout: float, description: str) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.1)
    raise ContractError(f"timed out waiting for {description}")


def collect_process(
    process: subprocess.Popen[str], label: str, deadline: float
) -> tuple[str, str]:
    remaining = max(0.1, deadline - time.monotonic())
    try:
        stdout, stderr = process.communicate(timeout=remaining)
    except subprocess.TimeoutExpired as error:
        raise ContractError(f"{label} did not complete") from error
    if process.returncode != 0:
        raise ContractError(
            f"{label} exited {process.returncode}: {(stderr or stdout).strip()}"
        )
    return stdout, stderr


def stop_processes(processes: list[subprocess.Popen[str]]) -> None:
    for process in processes:
        if process.poll() is None:
            process.terminate()
    for process in processes:
        if process.poll() is None:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


def parse_worker(stdout: str, label: str, channel: str) -> WorkerResult:
    lines = [
        line.strip()
        for line in stdout.splitlines()
        if RESULT_PATTERN.match(line.strip())
    ]
    if len(lines) != 1:
        raise ContractError(f"{label} returned {len(lines)} result rows")
    parts = lines[0].split("|", 4)
    if len(parts) != 5:
        raise ContractError(f"{label} returned an unexpected result shape")
    _, outcome, raw_job_id, sqlstate, message = parts
    if outcome not in {"success", "error"}:
        raise ContractError(f"{label} returned invalid outcome: {outcome}")
    job_id = raw_job_id or None
    if job_id is not None:
        try:
            uuid.UUID(job_id)
        except ValueError as error:
            raise ContractError(f"{label} returned invalid job id") from error
    return WorkerResult(channel, outcome, job_id, sqlstate, message)


def assert_identical_results(results: tuple[WorkerResult, WorkerResult]) -> str:
    if any(
        result.outcome != "success"
        or result.job_id is None
        or result.sqlstate != "00000"
        or result.message != ""
        for result in results
    ):
        raise ContractError("identical race did not produce two clean successes")
    if results[0].job_id != results[1].job_id:
        raise ContractError("identical race returned different job ids")
    return results[0].job_id


def assert_conflict_results(
    results: tuple[WorkerResult, WorkerResult],
) -> WorkerResult:
    successes = [
        result
        for result in results
        if result.outcome == "success"
        and result.job_id is not None
        and result.sqlstate == "00000"
        and result.message == ""
    ]
    conflicts = [
        result
        for result in results
        if result.outcome == "error"
        and result.job_id is None
        and result.sqlstate == "23505"
        and result.message == "publication_idempotency_conflict"
    ]
    if len(successes) != 1 or len(conflicts) != 1:
        raise ContractError("conflict race did not produce one success and one conflict")
    return successes[0]


def assert_database_state(
    psql: Psql,
    fixture: Fixture,
    idempotency_key: str,
    expected_channel: str,
) -> None:
    state = psql.scalar(
        f"""
select
    count(*),
    count(*) filter (
        where job.resource_type = 'CONTENT_ITEM'
          and job.resource_id = '{fixture.content_id}'
          and job.channel = '{expected_channel}'
          and job.approval_id = '{fixture.approval_id}'
          and job.content_hash = '{CONTENT_HASH}'
          and job.requested_by = '{fixture.principal_id}'
          and job.status = 'APPROVED'
          and job.scheduled_for is null
    ),
    (select count(*)
       from public.v2_cmo_audit_events audit
       join public.v2_cmo_publication_jobs persisted
         on persisted.id = audit.resource_id
      where persisted.idempotency_key = '{idempotency_key}'
        and audit.actor_principal_id = '{fixture.principal_id}'
        and audit.event_type = 'PUBLICATION_INTENT_CREATED'
        and audit.resource_type = 'PUBLICATION_JOB'
        and audit.payload = pg_catalog.jsonb_build_object(
            'resource_id', '{fixture.content_id}'::uuid,
            'channel', persisted.channel
        ))
from public.v2_cmo_publication_jobs job
where job.idempotency_key = '{idempotency_key}';
"""
    )
    if state != "1|1|1":
        raise ContractError(f"unexpected persisted publication race state: {state}")


def run_scenario(
    psql: Psql,
    fixture: Fixture,
    scenario: str,
    idempotency_key: str,
    channels: tuple[str, str],
    barrier_seconds: float,
    hold_seconds: float,
) -> tuple[WorkerResult, WorkerResult]:
    advisory_key = secrets.randbelow((1 << 62) - 1) + 1
    run_label = f"kippy_cmo_{scenario}_{uuid.uuid4().hex[:10]}"
    controller_name = f"{run_label}_controller"
    worker_names = (f"{run_label}_worker_1", f"{run_label}_worker_2")
    processes: list[subprocess.Popen[str]] = []
    try:
        controller = psql.popen(
            f"select pg_advisory_lock({advisory_key}::bigint); "
            f"select pg_sleep({barrier_seconds}); "
            f"select pg_advisory_unlock({advisory_key}::bigint);",
            application_name=controller_name,
        )
        processes.append(controller)
        wait_until(
            lambda: psql.scalar(
                "select count(*) from pg_locks lock "
                "join pg_stat_activity activity on activity.pid = lock.pid "
                "where lock.locktype = 'advisory' and lock.granted "
                "and lock.mode = 'ExclusiveLock' "
                f"and activity.application_name = '{controller_name}';"
            )
            == "1",
            timeout=5,
            description=f"{scenario} controller barrier",
        )

        workers = (
            psql.popen(
                worker_sql(
                    fixture,
                    advisory_key,
                    channels[0],
                    idempotency_key,
                    hold_seconds,
                ),
                application_name=worker_names[0],
            ),
            psql.popen(
                worker_sql(
                    fixture,
                    advisory_key,
                    channels[1],
                    idempotency_key,
                    hold_seconds,
                ),
                application_name=worker_names[1],
            ),
        )
        processes.extend(workers)
        wait_until(
            lambda: psql.scalar(
                "select count(*) from pg_locks lock "
                "join pg_stat_activity activity on activity.pid = lock.pid "
                "where lock.locktype = 'advisory' and not lock.granted "
                f"and activity.application_name in ('{worker_names[0]}', "
                f"'{worker_names[1]}');"
            )
            == "2",
            timeout=min(6, barrier_seconds - 1),
            description=f"both {scenario} workers at the advisory barrier",
        )
        print(f"{scenario.upper()}_WORKERS_AT_BARRIER=2")

        controller_deadline = time.monotonic() + barrier_seconds + 5
        collect_process(controller, f"{scenario} controller", controller_deadline)
        wait_until(
            lambda: int(
                psql.scalar(
                    "select count(*) from pg_locks lock "
                    "join pg_stat_activity activity on activity.pid = lock.pid "
                    "where lock.locktype = 'transactionid' "
                    "and not lock.granted "
                    f"and activity.application_name in ('{worker_names[0]}', "
                    f"'{worker_names[1]}');"
                )
            )
            >= 1,
            timeout=hold_seconds + 5,
            description=f"{scenario} post-barrier transaction lock wait",
        )
        print(f"{scenario.upper()}_POST_BARRIER_LOCK_WAIT=OBSERVED")

        deadline = time.monotonic() + (2 * hold_seconds) + 10
        first_stdout, _ = collect_process(workers[0], f"{scenario} worker 1", deadline)
        second_stdout, _ = collect_process(workers[1], f"{scenario} worker 2", deadline)
        return (
            parse_worker(first_stdout, f"{scenario} worker 1", channels[0]),
            parse_worker(second_stdout, f"{scenario} worker 2", channels[1]),
        )
    finally:
        stop_processes(processes)


def cleanup_fixture(psql: Psql, fixture: Fixture) -> None:
    psql.run(
        f"""
begin;
alter table public.v2_cmo_audit_events
    disable trigger v2_cmo_audit_events_keep_append_only;
delete from public.v2_cmo_audit_events
 where actor_principal_id = '{fixture.principal_id}';
alter table public.v2_cmo_audit_events
    enable trigger v2_cmo_audit_events_keep_append_only;
delete from public.v2_cmo_publication_jobs
 where idempotency_key in ('{fixture.identical_key}', '{fixture.conflict_key}');
delete from public.v2_cmo_approval_requests where id = '{fixture.approval_id}';
delete from public.v2_cmo_content_items where id = '{fixture.content_id}';
delete from public.v2_cmo_campaign_briefs where id = '{fixture.brief_id}';
delete from public.v2_staff_role_assignments where id = '{fixture.assignment_id}';
delete from public.v2_staff_profiles where principal_id = '{fixture.principal_id}';
delete from public.v2_admin_principals where id = '{fixture.principal_id}';
delete from auth.users where id = '{fixture.auth_user_id}';
commit;
"""
    )
    cleanup_state = psql.scalar(
        f"""
select
    (select count(*) from auth.users where id = '{fixture.auth_user_id}'),
    (select count(*) from public.v2_admin_principals
      where id = '{fixture.principal_id}'),
    (select count(*) from public.v2_staff_profiles
      where principal_id = '{fixture.principal_id}'),
    (select count(*) from public.v2_staff_role_assignments
      where id = '{fixture.assignment_id}'),
    (select count(*) from public.v2_cmo_campaign_briefs
      where id = '{fixture.brief_id}'),
    (select count(*) from public.v2_cmo_content_items
      where id = '{fixture.content_id}'),
    (select count(*) from public.v2_cmo_approval_requests
      where id = '{fixture.approval_id}'),
    (select count(*) from public.v2_cmo_publication_jobs
      where idempotency_key in ('{fixture.identical_key}', '{fixture.conflict_key}')),
    (select count(*) from public.v2_cmo_audit_events
      where actor_principal_id = '{fixture.principal_id}'),
    (select trigger.tgenabled = 'O'
       from pg_trigger trigger
      where trigger.tgrelid = 'public.v2_cmo_audit_events'::regclass
        and trigger.tgname = 'v2_cmo_audit_events_keep_append_only');
"""
    )
    if cleanup_state != "0|0|0|0|0|0|0|0|0|t":
        raise ContractError(
            "publication race cleanup incomplete; dispose the local database: "
            f"{cleanup_state}"
        )
    print(f"RACE_CLEANUP_STATE={cleanup_state}")


def run_contract(psql: Psql, barrier_seconds: float, hold_seconds: float) -> None:
    fixture = new_fixture()
    try:
        setup_fixture(psql, fixture)

        identical_results = run_scenario(
            psql,
            fixture,
            "identical",
            fixture.identical_key,
            ("WEBSITE", "WEBSITE"),
            barrier_seconds,
            hold_seconds,
        )
        assert_identical_results(identical_results)
        assert_database_state(
            psql, fixture, fixture.identical_key, expected_channel="WEBSITE"
        )
        print(
            "IDENTICAL_SANITIZED_RESULTS="
            f"{[(r.outcome, r.sqlstate, r.job_id is not None) for r in identical_results]}"
        )
        print("IDENTICAL_SAME_JOB=true")

        conflict_results = run_scenario(
            psql,
            fixture,
            "conflict",
            fixture.conflict_key,
            ("WEBSITE", "FOUNDER"),
            barrier_seconds,
            hold_seconds,
        )
        conflict_winner = assert_conflict_results(conflict_results)
        assert_database_state(
            psql,
            fixture,
            fixture.conflict_key,
            expected_channel=conflict_winner.channel,
        )
        print(
            "CONFLICT_SANITIZED_RESULTS="
            f"{[(r.outcome, r.sqlstate, r.message, r.job_id is not None) for r in conflict_results]}"
        )

        total_state = psql.scalar(
            f"""
select
    (select count(*) from public.v2_cmo_publication_jobs
      where idempotency_key in ('{fixture.identical_key}', '{fixture.conflict_key}')),
    (select count(*) from public.v2_cmo_audit_events
      where actor_principal_id = '{fixture.principal_id}'
        and event_type = 'PUBLICATION_INTENT_CREATED'
        and resource_type = 'PUBLICATION_JOB');
"""
        )
        if total_state != "2|2":
            raise ContractError(f"unexpected aggregate publication state: {total_state}")
        print("PUBLICATION_RACE_TEST=PASS")
    finally:
        cleanup_fixture(psql, fixture)


def main() -> int:
    args = parse_args()
    try:
        require_loopback(args.host)
        psql = Psql(
            resolve_psql(args.psql),
            args.host,
            args.port,
            args.user,
            args.database,
        )
        verify_baseline(psql)
        run_contract(psql, args.barrier_seconds, args.winner_hold_seconds)
    except (ContractError, subprocess.TimeoutExpired) as error:
        print(f"PUBLICATION_RACE_TEST=FAIL: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
