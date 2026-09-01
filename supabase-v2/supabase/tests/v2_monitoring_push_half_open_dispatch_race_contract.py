#!/usr/bin/env python3
"""Two-connection half-open dispatcher race on disposable localhost."""

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


EXPECTED_MIGRATION_COUNT = 63
EXPECTED_FIRST_MIGRATION = "20260727150000"
EXPECTED_LAST_MIGRATION = "20260901180000"
RESULT_PATTERN = re.compile(r"^RESULT\|([01])$")
VISIBLE_PATTERN = re.compile(r"^VISIBLE\|([01])\|([01])$")
CIRCUIT_LOCK_CLASS_ID = 20260901
CIRCUIT_LOCK_OBJECT_ID = 180000


class ContractError(RuntimeError):
    """Raised when the disposable race contract is not satisfied."""


@dataclass(frozen=True)
class Fixture:
    guardian_id: uuid.UUID
    family_id: uuid.UUID
    child_id: uuid.UUID
    device_id: uuid.UUID
    installation_id: uuid.UUID
    transition_id: uuid.UUID
    episode_id: uuid.UUID
    delivery_id: uuid.UUID
    endpoint_id: uuid.UUID
    endpoint_installation_id: uuid.UUID
    barrier_key: int
    worker_endpoint: str
    worker_trigger_token: str


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
            "Race two real owner connections through the half-open monitoring "
            "dispatcher on a disposable local 63-migration database."
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
        help="Confirm that committed synthetic fixtures may be written.",
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
    endpoint_label = uuid.uuid4().hex
    return Fixture(
        guardian_id=uuid.uuid4(),
        family_id=uuid.uuid4(),
        child_id=uuid.uuid4(),
        device_id=uuid.uuid4(),
        installation_id=uuid.uuid4(),
        transition_id=uuid.uuid4(),
        episode_id=uuid.uuid4(),
        delivery_id=uuid.uuid4(),
        endpoint_id=uuid.uuid4(),
        endpoint_installation_id=uuid.uuid4(),
        barrier_key=secrets.randbelow((1 << 62) - 1) + 1,
        worker_endpoint=(
            f"https://half-open-{endpoint_label}.invalid/functions/v1/"
            "v2-deliver-monitoring-push"
        ),
        worker_trigger_token=secrets.token_urlsafe(48),
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

    extension_state = psql.scalar(
        "select "
        "exists(select 1 from pg_extension where extname = 'pg_cron'),"
        "exists(select 1 from pg_extension where extname = 'pg_net'),"
        "exists(select 1 from pg_extension where extname = 'supabase_vault'),"
        "to_regclass('cron.job') is not null,"
        "to_regclass('net.http_request_queue') is not null,"
        "to_regclass('vault.decrypted_secrets') is not null;"
    )
    if extension_state != "t|t|t|t|t|t":
        raise ContractError(f"unexpected Supabase extension baseline: {extension_state}")

    role_state = psql.scalar(
        "select "
        "exists(select 1 from pg_roles where rolname = 'anon'),"
        "exists(select 1 from pg_roles where rolname = 'authenticated'),"
        "exists(select 1 from pg_roles where rolname = 'service_role'),"
        "not has_function_privilege('anon',"
        "'public.v2_dispatch_monitoring_push_worker_internal(integer)',"
        "'EXECUTE'),"
        "not has_function_privilege('authenticated',"
        "'public.v2_dispatch_monitoring_push_worker_internal(integer)',"
        "'EXECUTE'),"
        "not has_function_privilege('service_role',"
        "'public.v2_dispatch_monitoring_push_worker_internal(integer)',"
        "'EXECUTE');"
    )
    if role_state != "t|t|t|t|t|t":
        raise ContractError(f"unexpected Supabase role/ACL baseline: {role_state}")

    state = psql.scalar(
        "select "
        "(select count(*) from public.v2_monitoring_alert_deliveries "
        "where status in ('queued','failed')),"
        "(select count(*) from public.v2_monitoring_push_dispatch_runs),"
        "(select count(*) from public.v2_monitoring_push_activation_epochs "
        "where enablement_prepared_at is not null),"
        "(select count(*) from vault.secrets where name in ("
        "'kippy_v2_monitoring_push_worker_endpoint',"
        "'kippy_v2_monitoring_push_worker_trigger_token'));"
    )
    if state != "0|0|0|0":
        raise ContractError(f"race requires a clean disposable baseline: {state}")
    print(f"LOCAL_BASELINE={len(applied)}|{applied[0]}|{applied[-1]}")
    print("SUPABASE_EXTENSIONS=pg_cron|pg_net|supabase_vault")
    print("SUPABASE_ROLES=anon|authenticated|service_role|dispatcher_denied")


def setup_fixture(psql: Psql, fixture: Fixture) -> None:
    push_endpoint = (
        "https://fcm.googleapis.com/fcm/send/half-open-race-"
        f"{fixture.endpoint_id.hex}"
    )
    psql.run(
        f"""
begin;
select public.v2_prepare_monitoring_push_activation_internal();
insert into auth.users (id) values ('{fixture.guardian_id}');
insert into public.v2_families (id, display_name)
values ('{fixture.family_id}', 'Half-open dispatcher race family');
insert into public.v2_guardian_memberships (
    family_id, guardian_user_id, role, status
) values ('{fixture.family_id}', '{fixture.guardian_id}', 'owner', 'active');
insert into public.v2_children (id, family_id, display_name)
values ('{fixture.child_id}', '{fixture.family_id}', 'Half-open race child');
insert into public.v2_protected_devices (
    id, child_id, installation_id, app_version, status
) values (
    '{fixture.device_id}', '{fixture.child_id}',
    '{fixture.installation_id}', 'half-open-race', 'active'
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
) values (
    '{fixture.endpoint_id}', '{fixture.guardian_id}',
    '{fixture.endpoint_installation_id}', '{push_endpoint}',
    encode(extensions.digest(convert_to('{push_endpoint}', 'UTF8'), 'sha256'), 'hex'),
    repeat('A', 88), repeat('B', 24), 'half-open-race', 'he-IL',
    'granted', 'active'
);
insert into public.v2_monitoring_alert_deliveries (
    id, transition_id, guardian_user_id, alert_type, severity,
    idempotency_key, next_attempt_at, expires_at
) values (
    '{fixture.delivery_id}', '{fixture.transition_id}',
    '{fixture.guardian_id}', 'monitoring_interrupted', 'critical',
    'half-open-race:{fixture.delivery_id}', now() - interval '1 second',
    now() + interval '6 hours'
);
select vault.create_secret(
    '{fixture.worker_endpoint}',
    'kippy_v2_monitoring_push_worker_endpoint',
    'Disposable half-open dispatcher race endpoint'
);
select vault.create_secret(
    '{fixture.worker_trigger_token}',
    'kippy_v2_monitoring_push_worker_trigger_token',
    'Disposable half-open dispatcher race token'
);
update public.v2_monitoring_push_circuit_breaker
   set circuit_state = 'open',
       consecutive_worker_failures = 3,
       consecutive_cron_failures = 0,
       open_reason = 'worker_failures',
       opened_at = statement_timestamp() - interval '11 minutes',
       cooldown_until = statement_timestamp() - interval '1 minute',
       half_open_started_at = null,
       half_open_probe_dispatched_at = null,
       provider_window_started_at = statement_timestamp(),
       last_observed_cron_run_id = 0
 where singleton;
commit;
"""
    )


def worker_sql(fixture: Fixture, hold_seconds: float) -> str:
    return f"""
begin;
select pg_advisory_xact_lock_shared({fixture.barrier_key}::bigint);
select 'RESULT|' || public.v2_dispatch_monitoring_push_worker_internal(8)::text;
select 'VISIBLE|' ||
       (select count(*)::text
          from public.v2_monitoring_push_dispatch_runs run
         where run.is_half_open_probe) || '|' ||
       (select count(*)::text
          from net.http_request_queue request
         where request.url = '{fixture.worker_endpoint}');
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


def assert_process_results(first_stdout: str, second_stdout: str) -> None:
    dispatch_results: list[int] = []
    visible_states: list[tuple[int, int]] = []
    for stdout in (first_stdout, second_stdout):
        result_matches = [
            RESULT_PATTERN.fullmatch(line.strip()) for line in stdout.splitlines()
        ]
        result_values = [
            int(match.group(1)) for match in result_matches if match is not None
        ]
        visible_matches = [
            VISIBLE_PATTERN.fullmatch(line.strip()) for line in stdout.splitlines()
        ]
        visible_values = [
            (int(match.group(1)), int(match.group(2)))
            for match in visible_matches
            if match is not None
        ]
        if len(result_values) != 1 or len(visible_values) != 1:
            raise ContractError("worker output did not match the sanitized race contract")
        dispatch_results.extend(result_values)
        visible_states.extend(visible_values)

    if sorted(dispatch_results) != [0, 1]:
        raise ContractError(f"expected dispatcher results [0,1]: {dispatch_results}")
    if sorted(visible_states) != [(0, 0), (1, 1)]:
        raise ContractError(
            f"expected one transaction-local pg_net request/run: {visible_states}"
        )
    print(f"SANITIZED_DISPATCH_RESULTS={sorted(dispatch_results)}")
    print(f"TRANSACTION_VISIBLE_RUN_AND_PG_NET={sorted(visible_states)}")


def assert_database_state(psql: Psql, fixture: Fixture) -> None:
    state = psql.scalar(
        "select "
        "count(*),"
        "count(*) filter (where request_id is not null),"
        "count(*) filter (where is_half_open_probe),"
        "count(distinct request_id) filter (where request_id is not null) "
        "from public.v2_monitoring_push_dispatch_runs;"
    )
    if state != "1|1|1|1":
        raise ContractError(f"unexpected persisted dispatch state: {state}")

    circuit_state = psql.scalar(
        "select circuit_state,"
        "half_open_started_at is not null,"
        "half_open_probe_dispatched_at is not null "
        "from public.v2_monitoring_push_circuit_breaker where singleton;"
    )
    if circuit_state != "half_open|t|t":
        raise ContractError(f"unexpected persisted circuit state: {circuit_state}")

    audit_state = psql.scalar(
        "select "
        "count(*) filter (where action = 'v2.monitoring.push_circuit.half_open'),"
        "count(*) filter (where action = 'v2.monitoring.push_circuit.block' "
        "and metadata->>'reason' = 'concurrent_dispatch') "
        "from public.v2_audit_events;"
    )
    if audit_state != "1|1":
        raise ContractError(f"unexpected circuit audit state: {audit_state}")
    print(f"RACE_DB_STATE={state}|circuit={circuit_state}|audit={audit_state}")


def cleanup_fixture(psql: Psql, fixture: Fixture) -> None:
    psql.run(
        f"""
begin;
delete from net.http_request_queue request
 where request.url = '{fixture.worker_endpoint}';
delete from public.v2_monitoring_push_dispatch_runs;
delete from public.v2_audit_events
 where action like 'v2.monitoring.push_circuit.%'
    or action = 'v2.monitoring.push_activation.prepare';
delete from public.v2_monitoring_alert_deliveries
 where id = '{fixture.delivery_id}';
delete from public.v2_guardian_push_endpoints
 where id = '{fixture.endpoint_id}';
delete from public.v2_device_monitoring_transitions
 where id = '{fixture.transition_id}';
delete from public.v2_protected_devices where id = '{fixture.device_id}';
delete from public.v2_children where id = '{fixture.child_id}';
delete from public.v2_guardian_memberships
 where family_id = '{fixture.family_id}';
delete from public.v2_families where id = '{fixture.family_id}';
delete from auth.users where id = '{fixture.guardian_id}';
delete from vault.secrets secret
 where secret.name in (
    'kippy_v2_monitoring_push_worker_endpoint',
    'kippy_v2_monitoring_push_worker_trigger_token'
 );
update public.v2_monitoring_push_activation_epochs
   set activation_cutoff = dormant_deployment_cutoff,
       enablement_prepared_at = null
 where singleton;
update public.v2_monitoring_push_circuit_breaker
   set circuit_state = 'closed',
       consecutive_worker_failures = 0,
       consecutive_cron_failures = 0,
       open_reason = null,
       opened_at = null,
       cooldown_until = null,
       half_open_started_at = null,
       half_open_probe_dispatched_at = null,
       provider_window_started_at = statement_timestamp(),
       last_observed_cron_run_id = 0
 where singleton;
commit;
"""
    )
    remaining = psql.scalar(
        f"""
select
    (select count(*) from auth.users where id = '{fixture.guardian_id}'),
    (select count(*) from public.v2_families where id = '{fixture.family_id}'),
    (select count(*) from public.v2_monitoring_alert_deliveries
      where id = '{fixture.delivery_id}'),
    (select count(*) from public.v2_monitoring_push_dispatch_runs),
    (select count(*) from vault.secrets where name in (
        'kippy_v2_monitoring_push_worker_endpoint',
        'kippy_v2_monitoring_push_worker_trigger_token'
    ));
"""
    )
    if remaining != "0|0|0|0|0":
        raise ContractError(f"half-open race cleanup incomplete: {remaining}")
    print(f"RACE_CLEANUP_STATE={remaining}")


def run_contract(psql: Psql, barrier_seconds: float, hold_seconds: float) -> None:
    fixture = new_fixture()
    label = f"kippy_half_open_dispatch_race_{uuid.uuid4().hex[:8]}"
    controller_name = f"{label}_controller"
    worker_one_name = f"{label}_worker_1"
    worker_two_name = f"{label}_worker_2"
    processes: list[subprocess.Popen[str]] = []
    setup_complete = False
    try:
        setup_fixture(psql, fixture)
        setup_complete = True

        controller = psql.popen(
            f"select pg_advisory_lock({fixture.barrier_key}::bigint);"
            f"select pg_sleep({barrier_seconds});"
            f"select pg_advisory_unlock({fixture.barrier_key}::bigint);",
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
            worker_sql(fixture, hold_seconds), application_name=worker_one_name
        )
        worker_two = psql.popen(
            worker_sql(fixture, hold_seconds), application_name=worker_two_name
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
            "both dispatchers at barrier",
        )
        print("DISPATCHERS_AT_BARRIER=2")

        wait_until(
            lambda: psql.scalar(
                "select count(*) from pg_locks lock "
                "join pg_stat_activity activity on activity.pid = lock.pid "
                "where lock.locktype = 'advisory' and lock.granted "
                "and lock.mode = 'ExclusiveLock' "
                f"and lock.classid = {CIRCUIT_LOCK_CLASS_ID}::oid "
                f"and lock.objid = {CIRCUIT_LOCK_OBJECT_ID}::oid "
                f"and activity.application_name in ('{worker_one_name}',"
                f"'{worker_two_name}');"
            )
            == "1",
            barrier_seconds + hold_seconds + 5,
            "one dispatcher holding the circuit lock",
        )
        print("HALF_OPEN_CIRCUIT_LOCK_HOLDERS=1")

        deadline = time.monotonic() + barrier_seconds + (2 * hold_seconds) + 10
        first_stdout = collect_process(worker_one, "dispatcher 1", deadline)
        second_stdout = collect_process(worker_two, "dispatcher 2", deadline)
        collect_process(controller, "controller", deadline)
        assert_process_results(first_stdout, second_stdout)
        assert_database_state(psql, fixture)
        print("MONITORING_HALF_OPEN_DISPATCH_RACE=PASS")
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
        print(f"MONITORING_HALF_OPEN_DISPATCH_RACE=FAIL: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
