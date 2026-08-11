#!/usr/bin/env python3
"""Real two-connection lease race contract for a disposable local V2 database."""

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
from datetime import datetime, timedelta, timezone
from pathlib import Path


EXPECTED_MIGRATION_COUNT = 52
EXPECTED_FIRST_MIGRATION = "20260727150000"
EXPECTED_LAST_MIGRATION = "20260810211000"
RESULT_PATTERN = re.compile(r"^[0-9a-f-]{36}\|")


class ContractError(RuntimeError):
    """Raised when the disposable race contract is not satisfied."""


@dataclass(frozen=True)
class Fixture:
    auth_user_id: uuid.UUID
    family_id: uuid.UUID
    child_id: uuid.UUID
    device_id: uuid.UUID
    installation_id: uuid.UUID
    client_incident_id: uuid.UUID
    occurred_at: str
    context_expires_at: str
    advisory_key: int


@dataclass(frozen=True)
class RaceRow:
    incident_id: str
    created: bool
    analysis_state: str
    token_is_null: bool
    token_length: int
    incident_status: str
    outcome_is_null: bool
    delivery_count: int


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

    def scalar(self, sql: str, *, timeout: float = 30) -> str:
        lines = self.rows(sql, timeout=timeout)
        if len(lines) != 1:
            raise ContractError(f"expected one scalar row, received {len(lines)}")
        return lines[0]

    def rows(self, sql: str, *, timeout: float = 30) -> list[str]:
        return [
            line.strip()
            for line in self.run(sql, timeout=timeout).splitlines()
            if line.strip()
        ]

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
            "Run a committed-fixture, two-connection lease race against a "
            "disposable local 52-migration Kippy V2 database."
        )
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--database", default="postgres")
    parser.add_argument("--psql", default="psql")
    parser.add_argument("--barrier-seconds", type=float, default=10)
    parser.add_argument("--winner-hold-seconds", type=float, default=4)
    parser.add_argument(
        "--confirm-disposable-local",
        action="store_true",
        help="Confirm that the loopback target may receive committed test fixtures.",
    )
    args = parser.parse_args()
    if not args.confirm_disposable_local:
        parser.error("--confirm-disposable-local is required")
    if args.barrier_seconds < 5:
        parser.error("--barrier-seconds must be at least 5")
    if not 1 <= args.winner_hold_seconds <= 15:
        parser.error("--winner-hold-seconds must be between 1 and 15")
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
    now = datetime.now(timezone.utc)
    occurred_at = (now - timedelta(minutes=1)).isoformat(timespec="milliseconds")
    context_expires_at = (now + timedelta(days=1)).isoformat(timespec="milliseconds")
    return Fixture(
        auth_user_id=uuid.uuid4(),
        family_id=uuid.uuid4(),
        child_id=uuid.uuid4(),
        device_id=uuid.uuid4(),
        installation_id=uuid.uuid4(),
        client_incident_id=uuid.uuid4(),
        occurred_at=occurred_at,
        context_expires_at=context_expires_at,
        advisory_key=secrets.randbelow((1 << 62) - 1) + 1,
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
        "select "
        "to_regprocedure('public.v2_begin_ephemeral_incident_analysis_service"
        "(uuid,uuid,text,text,text,real,real,timestamptz,smallint,smallint,"
        "bigint,integer,smallint,timestamptz,text,integer)') is not null, "
        "to_regprocedure('public.v2_release_ephemeral_incident_analysis_service"
        "(uuid,text)') is not null, "
        "has_function_privilege('service_role', "
        "'public.v2_begin_ephemeral_incident_analysis_service"
        "(uuid,uuid,text,text,text,real,real,timestamptz,smallint,smallint,"
        "bigint,integer,smallint,timestamptz,text,integer)', 'EXECUTE');"
    )
    if rpc_contract != "t|t|t":
        raise ContractError(f"unexpected local RPC contract: {rpc_contract}")
    effective_role = psql.scalar(
        "begin; set local role service_role; select current_user; rollback;"
    )
    if effective_role != "service_role":
        raise ContractError(f"could not assume service_role: {effective_role}")
    print(
        f"LOCAL_BASELINE={len(applied_versions)}|{applied_versions[0]}|"
        f"{applied_versions[-1]}"
    )


def setup_fixture(psql: Psql, fixture: Fixture) -> None:
    psql.run(
        f"""
begin;
insert into auth.users (id) values ('{fixture.auth_user_id}');
insert into public.v2_families (id, display_name)
values ('{fixture.family_id}', 'Ephemeral race contract family');
insert into public.v2_guardian_memberships (
    family_id, guardian_user_id, role, status
) values (
    '{fixture.family_id}', '{fixture.auth_user_id}', 'owner', 'active'
);
insert into public.v2_children (id, family_id, display_name)
values (
    '{fixture.child_id}', '{fixture.family_id}',
    'Ephemeral race contract child'
);
insert into public.v2_protected_devices (
    id, child_id, installation_id, app_version, status
) values (
    '{fixture.device_id}', '{fixture.child_id}',
    '{fixture.installation_id}', '2.0.0-race-test', 'active'
);
commit;
"""
    )


def worker_sql(fixture: Fixture, hold_seconds: float) -> str:
    return f"""
begin;
set local role service_role;
select pg_advisory_xact_lock_shared({fixture.advisory_key}::bigint);
with result as (
    select *
    from public.v2_begin_ephemeral_incident_analysis_service(
        '{fixture.device_id}',
        '{fixture.client_incident_id}',
        'exclusion',
        'high',
        'target',
        0.9::real,
        0.95::real,
        '{fixture.occurred_at}'::timestamptz,
        2::smallint,
        3::smallint,
        8::bigint,
        1::integer,
        2::smallint,
        '{fixture.context_expires_at}'::timestamptz,
        repeat('ef', 32),
        120::integer
    )
)
select incident_id::text,
       created::text,
       analysis_state,
       (lease_token is null)::text,
       coalesce(char_length(lease_token), 0)::text,
       incident_status,
       (analysis_outcome is null)::text,
       delivery_count::text
from result;
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


def parse_worker(stdout: str, label: str) -> RaceRow:
    lines = [line.strip() for line in stdout.splitlines() if RESULT_PATTERN.match(line.strip())]
    if len(lines) != 1:
        raise ContractError(f"{label} returned {len(lines)} result rows")
    parts = lines[0].split("|")
    if len(parts) != 8:
        raise ContractError(f"{label} returned an unexpected result shape")

    def strict_boolean(value: str, field: str) -> bool:
        if value not in {"true", "false"}:
            raise ContractError(f"{label} returned invalid {field}: {value}")
        return value == "true"

    return RaceRow(
        incident_id=parts[0],
        created=strict_boolean(parts[1], "created"),
        analysis_state=parts[2],
        token_is_null=strict_boolean(parts[3], "token_is_null"),
        token_length=int(parts[4]),
        incident_status=parts[5],
        outcome_is_null=strict_boolean(parts[6], "outcome_is_null"),
        delivery_count=int(parts[7]),
    )


def assert_worker_results(first: RaceRow, second: RaceRow) -> None:
    rows = (first, second)
    leased = [
        row
        for row in rows
        if row.created
        and row.analysis_state == "leased"
        and not row.token_is_null
        and row.token_length == 64
    ]
    busy = [
        row
        for row in rows
        if not row.created
        and row.analysis_state == "busy"
        and row.token_is_null
        and row.token_length == 0
    ]
    if len(leased) != 1 or len(busy) != 1:
        raise ContractError("expected one leased creator and one busy replay")
    if first.incident_id != second.incident_id:
        raise ContractError("workers returned different incident ids")
    if any(
        row.incident_status != "analyzing"
        or not row.outcome_is_null
        or row.delivery_count != 0
        for row in rows
    ):
        raise ContractError("worker result metadata violated the lease contract")


def assert_database_state(psql: Psql, fixture: Fixture) -> None:
    state = psql.scalar(
        f"""
select
    (select count(*)
       from public.v2_safety_incidents
      where device_id = '{fixture.device_id}'
        and client_incident_id = '{fixture.client_incident_id}'),
    (select count(*)
       from public.v2_ephemeral_incident_receipts receipt
       join public.v2_safety_incidents incident on incident.id = receipt.incident_id
      where incident.device_id = '{fixture.device_id}'
        and incident.client_incident_id = '{fixture.client_incident_id}'),
    (select receipt.state
       from public.v2_ephemeral_incident_receipts receipt
       join public.v2_safety_incidents incident on incident.id = receipt.incident_id
      where incident.device_id = '{fixture.device_id}'
        and incident.client_incident_id = '{fixture.client_incident_id}'),
    (select octet_length(receipt.lease_token_hash)
       from public.v2_ephemeral_incident_receipts receipt
       join public.v2_safety_incidents incident on incident.id = receipt.incident_id
      where incident.device_id = '{fixture.device_id}'
        and incident.client_incident_id = '{fixture.client_incident_id}'),
    (select receipt.lease_expires_at > now()
       from public.v2_ephemeral_incident_receipts receipt
       join public.v2_safety_incidents incident on incident.id = receipt.incident_id
      where incident.device_id = '{fixture.device_id}'
        and incident.client_incident_id = '{fixture.client_incident_id}'),
    (select count(*)
       from public.v2_audit_events audit
       join public.v2_safety_incidents incident on incident.id = audit.object_id
      where audit.action = 'v2.incident.submit.ephemeral'
        and incident.device_id = '{fixture.device_id}'
        and incident.client_incident_id = '{fixture.client_incident_id}'),
    (select count(*)
       from public.v2_incident_context context
       join public.v2_safety_incidents incident on incident.id = context.incident_id
      where incident.device_id = '{fixture.device_id}'
        and incident.client_incident_id = '{fixture.client_incident_id}'),
    (select count(*)
       from public.v2_incident_analysis_jobs job
       join public.v2_safety_incidents incident on incident.id = job.incident_id
      where incident.device_id = '{fixture.device_id}'
        and incident.client_incident_id = '{fixture.client_incident_id}');
"""
    )
    if state != "1|1|leased|32|t|1|0|0":
        raise ContractError(f"unexpected persisted race state: {state}")
    print(f"RACE_DB_STATE={state}")


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


def cleanup_fixture(psql: Psql, fixture: Fixture) -> None:
    incident_ids = psql.rows(
        f"""
select id::text from public.v2_safety_incidents
 where device_id = '{fixture.device_id}'
   and client_incident_id = '{fixture.client_incident_id}'
 order by id;
"""
    )
    if not incident_ids:
        incident_ids = ["00000000-0000-0000-0000-000000000000"]
    for incident_id in incident_ids:
        try:
            uuid.UUID(incident_id)
        except ValueError as error:
            raise ContractError(f"invalid cleanup incident id: {incident_id}") from error
    incident_id_list = ", ".join(f"'{value}'::uuid" for value in incident_ids)
    psql.run(
        f"""
begin;
delete from public.v2_audit_events
 where object_id in ({incident_id_list});
delete from public.v2_safety_incidents
 where device_id = '{fixture.device_id}'
   and client_incident_id = '{fixture.client_incident_id}';
delete from public.v2_protected_devices where id = '{fixture.device_id}';
delete from public.v2_children where id = '{fixture.child_id}';
delete from public.v2_guardian_memberships
 where family_id = '{fixture.family_id}'
   and guardian_user_id = '{fixture.auth_user_id}';
delete from public.v2_families where id = '{fixture.family_id}';
delete from auth.users where id = '{fixture.auth_user_id}';
commit;
"""
    )
    cleanup_state = psql.scalar(
        f"""
select
    (select count(*) from auth.users where id = '{fixture.auth_user_id}'),
    (select count(*) from public.v2_families where id = '{fixture.family_id}'),
    (select count(*) from public.v2_protected_devices where id = '{fixture.device_id}'),
    (select count(*) from public.v2_safety_incidents
      where client_incident_id = '{fixture.client_incident_id}'),
    (select count(*) from public.v2_ephemeral_incident_receipts
      where incident_id in ({incident_id_list})),
    (select count(*) from public.v2_incident_context
      where incident_id in ({incident_id_list})),
    (select count(*) from public.v2_incident_analysis_jobs
      where incident_id in ({incident_id_list})),
    (select count(*) from public.v2_audit_events
      where object_id in ({incident_id_list}));
"""
    )
    if cleanup_state != "0|0|0|0|0|0|0|0":
        raise ContractError(f"race cleanup incomplete: {cleanup_state}")
    print(f"RACE_CLEANUP_STATE={cleanup_state}")


def run_contract(psql: Psql, barrier_seconds: float, hold_seconds: float) -> None:
    fixture = new_fixture()
    run_label = f"kippy_ephemeral_race_{uuid.uuid4().hex[:10]}"
    controller_name = f"{run_label}_controller"
    worker_one_name = f"{run_label}_worker_1"
    worker_two_name = f"{run_label}_worker_2"
    processes: list[subprocess.Popen[str]] = []
    setup_complete = False
    try:
        setup_fixture(psql, fixture)
        setup_complete = True

        controller_sql = f"""
select pg_advisory_lock({fixture.advisory_key}::bigint);
select pg_sleep({barrier_seconds});
select pg_advisory_unlock({fixture.advisory_key}::bigint);
"""
        controller = psql.popen(
            controller_sql, application_name=controller_name
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
            description="controller advisory barrier",
        )
        print("CONTROLLER_BARRIER=HELD")

        worker_one = psql.popen(
            worker_sql(fixture, hold_seconds),
            application_name=worker_one_name,
        )
        worker_two = psql.popen(
            worker_sql(fixture, hold_seconds),
            application_name=worker_two_name,
        )
        processes.extend((worker_one, worker_two))

        wait_until(
            lambda: psql.scalar(
                "select count(*) from pg_locks lock "
                "join pg_stat_activity activity on activity.pid = lock.pid "
                "where lock.locktype = 'advisory' and not lock.granted "
                f"and activity.application_name in ('{worker_one_name}',"
                f"'{worker_two_name}');"
            )
            == "2",
            timeout=min(8, barrier_seconds - 1),
            description="both workers at the advisory barrier",
        )
        print("WORKERS_AT_BARRIER=2")

        wait_until(
            lambda: int(
                psql.scalar(
                    "select count(*) from pg_stat_activity "
                    f"where application_name in ('{worker_one_name}',"
                    f"'{worker_two_name}') "
                    "and wait_event_type = 'Lock' "
                    "and coalesce(wait_event, '') <> 'advisory';"
                )
            )
            >= 1,
            timeout=barrier_seconds + hold_seconds + 5,
            description="post-barrier database lock wait",
        )
        print("POST_BARRIER_LOCK_WAIT=OBSERVED")

        deadline = time.monotonic() + barrier_seconds + (2 * hold_seconds) + 10
        worker_one_stdout, _ = collect_process(worker_one, "worker 1", deadline)
        worker_two_stdout, _ = collect_process(worker_two, "worker 2", deadline)
        collect_process(controller, "controller", deadline)

        first = parse_worker(worker_one_stdout, "worker 1")
        second = parse_worker(worker_two_stdout, "worker 2")
        assert_worker_results(first, second)
        assert_database_state(psql, fixture)

        sanitized_results = sorted(
            (
                row.created,
                row.analysis_state,
                row.token_is_null,
                row.token_length,
            )
            for row in (first, second)
        )
        print(f"SANITIZED_RESULTS={sanitized_results}")
        print(f"SAME_INCIDENT={first.incident_id == second.incident_id}")
        print("RACE_TEST=PASS")
    finally:
        stop_processes(processes)
        if setup_complete:
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
        print(f"RACE_TEST=FAIL: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
