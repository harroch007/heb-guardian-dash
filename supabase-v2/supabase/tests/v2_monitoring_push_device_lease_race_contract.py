#!/usr/bin/env python3
"""Two-connection per-device monitoring lease race on disposable localhost."""

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


EXPECTED_MIGRATION_COUNT = 61
EXPECTED_FIRST_MIGRATION = "20260727150000"
EXPECTED_LAST_MIGRATION = "20260831161000"
CLAIM_PATTERN = re.compile(
    r"^[0-9a-f-]{36}\|[0-9a-f-]{36}\|64\|1$",
    re.IGNORECASE,
)


class ContractError(RuntimeError):
    """Raised when the disposable race contract is not satisfied."""


@dataclass(frozen=True)
class Fixture:
    guardian_one: uuid.UUID
    guardian_two: uuid.UUID
    family_id: uuid.UUID
    child_id: uuid.UUID
    device_id: uuid.UUID
    installation_id: uuid.UUID
    transition_id: uuid.UUID
    episode_id: uuid.UUID
    delivery_one: uuid.UUID
    delivery_two: uuid.UUID
    endpoint_one: uuid.UUID
    endpoint_two: uuid.UUID
    endpoint_installation_one: uuid.UUID
    endpoint_installation_two: uuid.UUID
    capability_token: str
    advisory_key: int


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
            "Race two monitoring claims against one device on a disposable "
            "local 61-migration Kippy V2 database."
        )
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--database", default="postgres")
    parser.add_argument("--psql", default="psql")
    parser.add_argument("--barrier-seconds", type=float, default=8)
    parser.add_argument("--winner-hold-seconds", type=float, default=3)
    parser.add_argument(
        "--confirm-disposable-local",
        action="store_true",
        help="Confirm that committed synthetic fixtures may be written.",
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
    return Fixture(
        guardian_one=uuid.uuid4(),
        guardian_two=uuid.uuid4(),
        family_id=uuid.uuid4(),
        child_id=uuid.uuid4(),
        device_id=uuid.uuid4(),
        installation_id=uuid.uuid4(),
        transition_id=uuid.uuid4(),
        episode_id=uuid.uuid4(),
        delivery_one=uuid.uuid4(),
        delivery_two=uuid.uuid4(),
        endpoint_one=uuid.uuid4(),
        endpoint_two=uuid.uuid4(),
        endpoint_installation_one=uuid.uuid4(),
        endpoint_installation_two=uuid.uuid4(),
        capability_token=secrets.token_urlsafe(32),
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
            f"expected {EXPECTED_MIGRATION_COUNT} migrations, found {len(versions)}"
        )
    return versions


def verify_baseline(psql: Psql) -> None:
    expected = canonical_migration_versions()
    applied = psql.rows(
        "select version from supabase_migrations.schema_migrations order by version;"
    )
    if applied != expected:
        raise ContractError("local migration ledger differs from canonical migrations")
    if applied[0] != EXPECTED_FIRST_MIGRATION or applied[-1] != EXPECTED_LAST_MIGRATION:
        raise ContractError("canonical migration endpoints are unexpected")
    rpc_state = psql.scalar(
        "select "
        "to_regprocedure('public.v2_claim_monitoring_delivery_service"
        "(text,uuid,integer)') is not null,"
        "to_regprocedure('public.v2_complete_monitoring_delivery_service"
        "(text,uuid,text,uuid,jsonb)') is not null,"
        "has_function_privilege('service_role',"
        "'public.v2_claim_monitoring_delivery_service(text,uuid,integer)',"
        "'EXECUTE');"
    )
    if rpc_state != "t|t|t":
        raise ContractError(f"unexpected monitoring RPC baseline: {rpc_state}")
    if psql.scalar(
        "select count(*) from public.v2_monitoring_alert_deliveries "
        "where status in ('queued','failed');"
    ) != "0":
        raise ContractError("race requires a clean disposable monitoring queue")
    print(f"LOCAL_BASELINE={len(applied)}|{applied[0]}|{applied[-1]}")


def setup_fixture(psql: Psql, fixture: Fixture) -> None:
    endpoint_one = (
        "https://fcm.googleapis.com/fcm/send/monitoring-race-endpoint-one-"
        f"{fixture.endpoint_one.hex}"
    )
    endpoint_two = (
        "https://fcm.googleapis.com/fcm/send/monitoring-race-endpoint-two-"
        f"{fixture.endpoint_two.hex}"
    )
    psql.run(
        f"""
begin;
insert into auth.users (id) values
    ('{fixture.guardian_one}'),
    ('{fixture.guardian_two}');
insert into public.v2_families (id, display_name)
values ('{fixture.family_id}', 'Monitoring lease race family');
insert into public.v2_guardian_memberships (
    family_id, guardian_user_id, role, status
) values
    ('{fixture.family_id}', '{fixture.guardian_one}', 'owner', 'active'),
    ('{fixture.family_id}', '{fixture.guardian_two}', 'guardian', 'active');
insert into public.v2_children (id, family_id, display_name)
values ('{fixture.child_id}', '{fixture.family_id}', 'Monitoring lease race child');
insert into public.v2_protected_devices (
    id, child_id, installation_id, app_version, status
) values (
    '{fixture.device_id}', '{fixture.child_id}',
    '{fixture.installation_id}', 'monitoring-race', 'active'
);
update public.v2_device_monitoring_state
   set monitoring_state = 'interrupted',
       state_version = 1,
       episode_id = '{fixture.episode_id}'
 where device_id = '{fixture.device_id}';
insert into public.v2_device_monitoring_transitions (
    id, device_id, episode_id, previous_state, new_state,
    reason_codes, source, state_version
) values (
    '{fixture.transition_id}', '{fixture.device_id}', '{fixture.episode_id}',
    'protected', 'interrupted', array['synthetic'], 'system', 1
);
insert into public.v2_guardian_push_endpoints (
    id, guardian_user_id, installation_id, endpoint, endpoint_hash,
    p256dh, auth_secret, user_agent, locale, permission_state, status
) values
    (
        '{fixture.endpoint_one}', '{fixture.guardian_one}',
        '{fixture.endpoint_installation_one}', '{endpoint_one}',
        encode(extensions.digest(convert_to('{endpoint_one}', 'UTF8'), 'sha256'), 'hex'),
        repeat('A', 88), repeat('B', 24), 'race-contract', 'he-IL',
        'granted', 'active'
    ),
    (
        '{fixture.endpoint_two}', '{fixture.guardian_two}',
        '{fixture.endpoint_installation_two}', '{endpoint_two}',
        encode(extensions.digest(convert_to('{endpoint_two}', 'UTF8'), 'sha256'), 'hex'),
        repeat('C', 88), repeat('D', 24), 'race-contract', 'he-IL',
        'granted', 'active'
    );
insert into public.v2_monitoring_alert_deliveries (
    id, transition_id, guardian_user_id, alert_type, severity,
    idempotency_key, next_attempt_at, expires_at
) values
    (
        '{fixture.delivery_one}', '{fixture.transition_id}',
        '{fixture.guardian_one}', 'monitoring_interrupted', 'critical',
        'race:{fixture.delivery_one}', now() - interval '1 second',
        now() + interval '6 hours'
    ),
    (
        '{fixture.delivery_two}', '{fixture.transition_id}',
        '{fixture.guardian_two}', 'monitoring_interrupted', 'critical',
        'race:{fixture.delivery_two}', now() - interval '1 second',
        now() + interval '6 hours'
    );
insert into public.v2_monitoring_push_worker_capabilities (
    token_hash, label, expires_at
) values (
    extensions.digest(convert_to('{fixture.capability_token}', 'UTF8'), 'sha256'),
    'Disposable monitoring lease race', now() + interval '1 hour'
);
commit;
"""
    )


def worker_sql(fixture: Fixture, worker_id: uuid.UUID, hold_seconds: float) -> str:
    return f"""
begin;
set local role service_role;
select pg_advisory_xact_lock_shared({fixture.advisory_key}::bigint);
select delivery_id::text,
       device_id::text,
       char_length(lease_token)::text,
       attempt_number::text
  from public.v2_claim_monitoring_delivery_service(
    '{fixture.capability_token}',
    '{worker_id}',
    120
  );
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
) -> str:
    try:
        stdout, stderr = process.communicate(timeout=max(0.1, deadline - time.monotonic()))
    except subprocess.TimeoutExpired as error:
        raise ContractError(f"{label} did not complete") from error
    if process.returncode != 0:
        raise ContractError(
            f"{label} exited {process.returncode}: {(stderr or stdout).strip()}"
        )
    return stdout


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


def assert_results(first_stdout: str, second_stdout: str) -> None:
    result_counts = []
    for stdout in (first_stdout, second_stdout):
        result_counts.append(
            sum(1 for line in stdout.splitlines() if CLAIM_PATTERN.fullmatch(line.strip()))
        )
    if sorted(result_counts) != [0, 1]:
        raise ContractError(f"expected one claim winner and one no-row loser: {result_counts}")
    print(f"SANITIZED_CLAIM_ROW_COUNTS={sorted(result_counts)}")


def assert_database_state(psql: Psql, fixture: Fixture) -> None:
    state = psql.scalar(
        f"""
select
    count(*),
    count(*) filter (where lease_expires_at > now()),
    count(*) filter (where lease_owner is null),
    count(*) filter (where attempt_count = 1),
    count(*) filter (where attempt_count = 0)
from public.v2_monitoring_alert_deliveries
where id in ('{fixture.delivery_one}', '{fixture.delivery_two}');
"""
    )
    if state != "2|1|1|1|1":
        raise ContractError(f"unexpected persisted device lease state: {state}")
    audit_count = psql.scalar(
        f"""
select count(*)
  from public.v2_audit_events
 where action = 'v2.monitoring.push_delivery.claim'
   and object_id in ('{fixture.delivery_one}', '{fixture.delivery_two}');
"""
    )
    if audit_count != "1":
        raise ContractError(f"unexpected claim audit count: {audit_count}")
    print(f"RACE_DB_STATE={state}|claim_audits={audit_count}")


def cleanup_fixture(psql: Psql, fixture: Fixture) -> None:
    psql.run(
        f"""
begin;
delete from public.v2_audit_events
 where object_id in ('{fixture.delivery_one}', '{fixture.delivery_two}');
delete from public.v2_monitoring_push_worker_capabilities
 where token_hash = extensions.digest(
    convert_to('{fixture.capability_token}', 'UTF8'), 'sha256'
 );
delete from public.v2_protected_devices where id = '{fixture.device_id}';
delete from public.v2_children where id = '{fixture.child_id}';
delete from public.v2_guardian_memberships where family_id = '{fixture.family_id}';
delete from public.v2_families where id = '{fixture.family_id}';
delete from auth.users where id in ('{fixture.guardian_one}', '{fixture.guardian_two}');
commit;
"""
    )
    remaining = psql.scalar(
        f"""
select
    (select count(*) from auth.users
      where id in ('{fixture.guardian_one}', '{fixture.guardian_two}')),
    (select count(*) from public.v2_families where id = '{fixture.family_id}'),
    (select count(*) from public.v2_protected_devices where id = '{fixture.device_id}'),
    (select count(*) from public.v2_monitoring_alert_deliveries
      where id in ('{fixture.delivery_one}', '{fixture.delivery_two}'));
"""
    )
    if remaining != "0|0|0|0":
        raise ContractError(f"monitoring race cleanup incomplete: {remaining}")
    print(f"RACE_CLEANUP_STATE={remaining}")


def run_contract(psql: Psql, barrier_seconds: float, hold_seconds: float) -> None:
    fixture = new_fixture()
    label = f"kippy_monitoring_lease_race_{uuid.uuid4().hex[:8]}"
    controller_name = f"{label}_controller"
    worker_one_name = f"{label}_worker_1"
    worker_two_name = f"{label}_worker_2"
    processes: list[subprocess.Popen[str]] = []
    setup_complete = False
    try:
        setup_fixture(psql, fixture)
        setup_complete = True

        controller = psql.popen(
            f"select pg_advisory_lock({fixture.advisory_key}::bigint);"
            f"select pg_sleep({barrier_seconds});"
            f"select pg_advisory_unlock({fixture.advisory_key}::bigint);",
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
            5,
            "controller barrier",
        )
        print("CONTROLLER_BARRIER=HELD")

        worker_one = psql.popen(
            worker_sql(fixture, uuid.uuid4(), hold_seconds),
            application_name=worker_one_name,
        )
        worker_two = psql.popen(
            worker_sql(fixture, uuid.uuid4(), hold_seconds),
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
            min(7, barrier_seconds - 1),
            "both workers at barrier",
        )
        print("WORKERS_AT_BARRIER=2")

        wait_until(
            lambda: int(
                psql.scalar(
                    "select count(*) from pg_stat_activity "
                    f"where application_name in ('{worker_one_name}',"
                    f"'{worker_two_name}') and wait_event_type = 'Lock' "
                    "and coalesce(wait_event, '') <> 'advisory';"
                )
            )
            >= 1,
            barrier_seconds + hold_seconds + 5,
            "post-barrier device-state lock wait",
        )
        print("POST_BARRIER_DEVICE_LOCK_WAIT=OBSERVED")

        deadline = time.monotonic() + barrier_seconds + (2 * hold_seconds) + 10
        first_stdout = collect_process(worker_one, "worker 1", deadline)
        second_stdout = collect_process(worker_two, "worker 2", deadline)
        collect_process(controller, "controller", deadline)
        assert_results(first_stdout, second_stdout)
        assert_database_state(psql, fixture)
        print("MONITORING_DEVICE_LEASE_RACE=PASS")
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
        print(f"MONITORING_DEVICE_LEASE_RACE=FAIL: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
