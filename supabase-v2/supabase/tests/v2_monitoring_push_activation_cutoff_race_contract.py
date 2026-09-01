#!/usr/bin/env python3
"""Old-transaction activation-cutoff race on disposable localhost only."""

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


class ContractError(RuntimeError):
    """Raised when the disposable cutoff race contract is not satisfied."""


@dataclass(frozen=True)
class Fixture:
    guardian_id: uuid.UUID
    family_id: uuid.UUID
    child_id: uuid.UUID
    device_id: uuid.UUID
    installation_id: uuid.UUID
    transition_id: uuid.UUID
    episode_id: uuid.UUID
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
            "Prove that a transaction started before monitoring activation, "
            "but enqueued after preparation committed, cannot replay delivery."
        )
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--database", default="postgres")
    parser.add_argument("--psql", default="psql")
    parser.add_argument("--barrier-seconds", type=float, default=12)
    parser.add_argument(
        "--confirm-disposable-local",
        action="store_true",
        help="Confirm that committed synthetic fixtures may be written.",
    )
    args = parser.parse_args()
    if not args.confirm_disposable_local:
        parser.error("--confirm-disposable-local is required")
    if not 8 <= args.barrier_seconds <= 30:
        parser.error("--barrier-seconds must be between 8 and 30")
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
    state = psql.scalar(
        "select "
        "count(*) filter (where enablement_prepared_at is not null),"
        "(select count(*) from public.v2_monitoring_alert_deliveries "
        "where status in ('queued','failed')) "
        "from public.v2_monitoring_push_activation_epochs;"
    )
    if state != "0|0":
        raise ContractError(f"cutoff race requires a dormant clean baseline: {state}")
    print(f"LOCAL_BASELINE={len(applied)}|{applied[0]}|{applied[-1]}")


def new_fixture() -> Fixture:
    return Fixture(
        guardian_id=uuid.uuid4(),
        family_id=uuid.uuid4(),
        child_id=uuid.uuid4(),
        device_id=uuid.uuid4(),
        installation_id=uuid.uuid4(),
        transition_id=uuid.uuid4(),
        episode_id=uuid.uuid4(),
        capability_token=secrets.token_urlsafe(32),
        advisory_key=secrets.randbelow((1 << 62) - 1) + 1,
    )


def setup_fixture(psql: Psql, fixture: Fixture) -> None:
    psql.run(
        f"""
begin;
insert into auth.users (id) values ('{fixture.guardian_id}');
insert into public.v2_families (id, display_name)
values ('{fixture.family_id}', 'Monitoring cutoff race family');
insert into public.v2_guardian_memberships (
    family_id, guardian_user_id, role, status
) values ('{fixture.family_id}', '{fixture.guardian_id}', 'owner', 'active');
insert into public.v2_children (id, family_id, display_name)
values ('{fixture.child_id}', '{fixture.family_id}', 'Monitoring cutoff race child');
insert into public.v2_protected_devices (
    id, child_id, installation_id, app_version, status
) values (
    '{fixture.device_id}', '{fixture.child_id}',
    '{fixture.installation_id}', 'cutoff-race', 'active'
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
insert into public.v2_monitoring_push_worker_capabilities (
    token_hash, label, expires_at
) values (
    extensions.digest(
        convert_to('{fixture.capability_token}', 'UTF8'),
        'sha256'
    ),
    'Disposable monitoring cutoff race',
    now() + interval '1 hour'
);
commit;
"""
    )


def old_transaction_sql(fixture: Fixture) -> str:
    return f"""
begin;
set local role service_role;
select transaction_timestamp();
select pg_advisory_xact_lock_shared({fixture.advisory_key}::bigint);
select public.v2_enqueue_monitoring_alerts_service('{fixture.transition_id}');
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


def prepare_while_old_transaction_waits(psql: Psql) -> None:
    result = psql.scalar(
        "select concat("
        "result->>'total_pending_before', '|',"
        "result->>'suppressed_count', '|',"
        "result->>'remaining_pending_after') "
        "from (select public.v2_prepare_monitoring_push_activation_internal() "
        "as result) prepared;"
    )
    if result != "0|0|0":
        raise ContractError(f"unexpected preparation counts: {result}")


def assert_post_cutoff_insert(psql: Psql, fixture: Fixture) -> None:
    state = psql.scalar(
        f"""
select
    count(*),
    count(*) filter (where delivery.status = 'queued'),
    count(*) filter (where delivery.created_at < epoch.activation_cutoff),
    count(*) filter (where delivery.attempt_count = 0),
    count(*) filter (where epoch.enablement_prepared_at is not null)
  from public.v2_monitoring_alert_deliveries delivery
 cross join public.v2_monitoring_push_activation_epochs epoch
 where epoch.singleton
   and delivery.transition_id = '{fixture.transition_id}'
   and delivery.guardian_user_id = '{fixture.guardian_id}';
"""
    )
    if state != "1|1|1|1|1":
        raise ContractError(f"old transaction was not classified pre-cutoff: {state}")
    print(f"POST_PREPARATION_OLD_TRANSACTION_INSERT={state}")


def assert_claim_suppresses(psql: Psql, fixture: Fixture) -> None:
    claim_output = psql.run(
        f"""
begin;
set local role service_role;
select delivery_id
  from public.v2_claim_monitoring_delivery_service(
    '{fixture.capability_token}',
    '{uuid.uuid4()}',
    120
  );
commit;
"""
    )
    claim_rows = [line for line in claim_output.splitlines() if line.strip()]
    if claim_rows:
        raise ContractError("pre-cutoff old transaction produced a claim")

    state = psql.scalar(
        f"""
select
    count(*),
    count(*) filter (where status = 'suppressed'),
    count(*) filter (where suppression_reason = 'pre_activation_cutoff'),
    count(*) filter (where attempt_count = 0),
    count(*) filter (where lease_owner is null)
  from public.v2_monitoring_alert_deliveries
 where transition_id = '{fixture.transition_id}'
   and guardian_user_id = '{fixture.guardian_id}';
"""
    )
    if state != "1|1|1|1|1":
        raise ContractError(f"claim-time cutoff suppression failed: {state}")
    print(f"CLAIM_TIME_CUTOFF_SUPPRESSION={state}|claim_rows=0")


def cleanup_fixture(psql: Psql, fixture: Fixture) -> None:
    psql.run(
        f"""
begin;
delete from public.v2_audit_events
 where action in (
    'v2.monitoring.push_activation.prepare',
    'v2.monitoring.push_delivery.suppress'
 );
delete from public.v2_monitoring_push_worker_capabilities
 where token_hash = extensions.digest(
    convert_to('{fixture.capability_token}', 'UTF8'), 'sha256'
 );
delete from public.v2_protected_devices where id = '{fixture.device_id}';
delete from public.v2_children where id = '{fixture.child_id}';
delete from public.v2_guardian_memberships where family_id = '{fixture.family_id}';
delete from public.v2_families where id = '{fixture.family_id}';
delete from auth.users where id = '{fixture.guardian_id}';
update public.v2_monitoring_push_activation_epochs
   set activation_cutoff = dormant_deployment_cutoff,
       enablement_prepared_at = null
 where singleton;
commit;
"""
    )
    remaining = psql.scalar(
        f"""
select
    (select count(*) from auth.users where id = '{fixture.guardian_id}'),
    (select count(*) from public.v2_families where id = '{fixture.family_id}'),
    (select count(*) from public.v2_protected_devices where id = '{fixture.device_id}'),
    (select count(*) from public.v2_monitoring_alert_deliveries
      where transition_id = '{fixture.transition_id}'),
    (select count(*) from public.v2_monitoring_push_activation_epochs
      where enablement_prepared_at is not null);
"""
    )
    if remaining != "0|0|0|0|0":
        raise ContractError(f"cutoff race cleanup incomplete: {remaining}")
    print(f"RACE_CLEANUP_STATE={remaining}")


def run_contract(psql: Psql, barrier_seconds: float) -> None:
    fixture = new_fixture()
    label = f"kippy_monitoring_cutoff_race_{uuid.uuid4().hex[:8]}"
    controller_name = f"{label}_controller"
    old_transaction_name = f"{label}_old_transaction"
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

        old_transaction = psql.popen(
            old_transaction_sql(fixture),
            application_name=old_transaction_name,
        )
        processes.append(old_transaction)
        wait_until(
            lambda: psql.scalar(
                "select count(*) from pg_locks lock "
                "join pg_stat_activity activity on activity.pid = lock.pid "
                "where lock.locktype = 'advisory' and not lock.granted "
                f"and activity.application_name = '{old_transaction_name}';"
            )
            == "1",
            5,
            "old transaction at pre-enqueue barrier",
        )
        print("OLD_TRANSACTION_PRE_CUTOFF_BARRIER=HELD")

        prepare_while_old_transaction_waits(psql)
        if old_transaction.poll() is not None:
            raise ContractError("old transaction completed before preparation boundary")
        blocked_after_preparation = psql.scalar(
            "select count(*) from pg_locks lock "
            "join pg_stat_activity activity on activity.pid = lock.pid "
            "where lock.locktype = 'advisory' and not lock.granted "
            f"and activity.application_name = '{old_transaction_name}';"
        )
        if blocked_after_preparation != "1":
            raise ContractError("old transaction was not blocked after preparation commit")
        print("PREPARATION_COMMITTED_BEFORE_OLD_ENQUEUE=PASS")

        deadline = time.monotonic() + barrier_seconds + 10
        collect_process(old_transaction, "old transaction", deadline)
        collect_process(controller, "controller", deadline)
        assert_post_cutoff_insert(psql, fixture)
        assert_claim_suppresses(psql, fixture)
        print("MONITORING_ACTIVATION_CUTOFF_RACE=PASS")
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
        run_contract(psql, args.barrier_seconds)
    except (ContractError, subprocess.TimeoutExpired) as error:
        print(f"MONITORING_ACTIVATION_CUTOFF_RACE=FAIL: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
