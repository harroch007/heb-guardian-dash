#!/usr/bin/env python3
"""Exercise the mandatory-location drift repair against a disposable local DB."""

from __future__ import annotations

import argparse
import ipaddress
import os
import shutil
import subprocess
import sys
from pathlib import Path


BASE_MIGRATION_VERSION = "20260901180000"
REPAIR_MIGRATION_VERSION = "20260902100000"
EXPECTED_BASE_MIGRATION_COUNT = 63
EXPECTED_FULL_MIGRATION_COUNT = 64
EXPECTED_FIRST_MIGRATION = "20260727150000"

TARGET_FAMILY_ID = "23000000-0000-0000-0000-000000000001"
TARGET_CHILD_ID = "33000000-0000-0000-0000-000000000001"
ACTIVE_DEVICE_ID = "43000000-0000-4000-8000-000000000001"
DEGRADED_DEVICE_ID = "43000000-0000-4000-8000-000000000002"
PENDING_DEVICE_ID = "43000000-0000-4000-8000-000000000003"
REVOKED_DEVICE_ID = "43000000-0000-4000-8000-000000000004"

CONTROL_FAMILY_ID = "23000000-0000-0000-0000-000000000002"
CONTROL_CHILD_ID = "33000000-0000-0000-0000-000000000002"
CONTROL_DEVICE_ID = "43000000-0000-4000-8000-000000000005"


class ContractError(RuntimeError):
    """Raised when the disposable migration regression is not satisfied."""


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

    def run(self, sql: str, *, timeout: float = 30) -> str:
        result = subprocess.run(
            [*self._base_args, "-c", sql],
            capture_output=True,
            text=True,
            timeout=timeout,
            env=os.environ.copy(),
            check=False,
        )
        if result.returncode != 0:
            detail = (result.stderr or result.stdout).strip()
            raise ContractError(f"psql exited {result.returncode}: {detail}")
        return result.stdout

    def run_file(self, path: Path, *, timeout: float = 120) -> str:
        result = subprocess.run(
            [*self._base_args, "-f", str(path)],
            capture_output=True,
            text=True,
            timeout=timeout,
            env=os.environ.copy(),
            check=False,
        )
        if result.returncode != 0:
            detail = (result.stderr or result.stdout).strip()
            raise ContractError(
                f"migration {path.name} exited {result.returncode}: {detail}"
            )
        return result.stdout

    def rows(self, sql: str, *, timeout: float = 30) -> list[str]:
        return [
            row.strip()
            for row in self.run(sql, timeout=timeout).splitlines()
            if row.strip()
        ]

    def scalar(self, sql: str, *, timeout: float = 30) -> str:
        rows = self.rows(sql, timeout=timeout)
        if len(rows) != 1:
            raise ContractError(f"expected one scalar row, received {len(rows)}")
        return rows[0]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Reset a disposable local Supabase database to the pre-repair base, "
            "reproduce the live mandatory-location drift, apply the forward repair, "
            "and prove its backfill and command-enqueue behavior."
        )
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--database", default="postgres")
    parser.add_argument("--psql", default="psql")
    parser.add_argument("--supabase", default="supabase")
    parser.add_argument(
        "--confirm-disposable-local",
        action="store_true",
        help="Confirm that the local database may be reset and populated.",
    )
    args = parser.parse_args()
    if not args.confirm_disposable_local:
        parser.error("--confirm-disposable-local is required")
    return args


def resolve_executable(value: str) -> str:
    candidate = Path(value)
    if candidate.is_file():
        return str(candidate.resolve())
    resolved = shutil.which(value)
    if not resolved:
        raise ContractError(f"executable not found: {value}")
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


def run_reset(
    supabase: str,
    workdir: Path,
    *,
    version: str | None,
    timeout: float = 600,
) -> None:
    command = [
        supabase,
        "db",
        "reset",
        "--local",
        "--no-seed",
        "--workdir",
        str(workdir),
        "--yes",
    ]
    if version:
        command.extend(["--version", version])
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=os.environ.copy(),
        check=False,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        label = version or "full"
        raise ContractError(f"Supabase {label} reset failed: {detail}")


def migration_versions(migration_directory: Path) -> list[str]:
    versions: list[str] = []
    for path in sorted(migration_directory.glob("*.sql")):
        version = path.name.split("_", maxsplit=1)[0]
        if len(version) != 14 or not version.isdigit():
            raise ContractError(f"unexpected migration filename: {path.name}")
        versions.append(version)
    return versions


def verify_ledger(
    psql: Psql,
    expected_versions: list[str],
    *,
    label: str,
) -> None:
    applied = psql.rows(
        "select version from supabase_migrations.schema_migrations order by version;"
    )
    if applied != expected_versions:
        raise ContractError(f"{label} ledger differs from expected migrations")
    print(
        f"{label.upper()}_LEDGER="
        f"{len(applied)}|{applied[0]}|{applied[-1]}"
    )


def reproduce_live_drift(psql: Psql) -> None:
    psql.run(
        f"""
begin;
alter table public.v2_parental_settings
    drop constraint if exists
        v2_parental_settings_location_tracking_mandatory;
alter table public.v2_parental_settings
    alter column location_tracking_enabled set default false;
comment on column public.v2_parental_settings.location_tracking_enabled is null;

insert into public.v2_families (id, display_name)
values
    ('{TARGET_FAMILY_ID}', 'Mandatory location drift family'),
    ('{CONTROL_FAMILY_ID}', 'Mandatory location control family');

insert into public.v2_children (id, family_id, display_name)
values
    ('{TARGET_CHILD_ID}', '{TARGET_FAMILY_ID}', 'Drifted child'),
    ('{CONTROL_CHILD_ID}', '{CONTROL_FAMILY_ID}', 'Unaffected child');

insert into public.v2_protected_devices (
    id, child_id, installation_id, app_version, manufacturer, model, status
)
values
    (
        '{ACTIVE_DEVICE_ID}', '{TARGET_CHILD_ID}',
        '53000000-0000-4000-8000-000000000001', 'drift-contract',
        'Kippy', 'Active sentinel', 'active'
    ),
    (
        '{DEGRADED_DEVICE_ID}', '{TARGET_CHILD_ID}',
        '53000000-0000-4000-8000-000000000002', 'drift-contract',
        'Kippy', 'Degraded sentinel', 'degraded'
    ),
    (
        '{PENDING_DEVICE_ID}', '{TARGET_CHILD_ID}',
        '53000000-0000-4000-8000-000000000003', 'drift-contract',
        'Kippy', 'Pending sentinel', 'pending'
    ),
    (
        '{REVOKED_DEVICE_ID}', '{TARGET_CHILD_ID}',
        '53000000-0000-4000-8000-000000000004', 'drift-contract',
        'Kippy', 'Revoked sentinel', 'revoked'
    ),
    (
        '{CONTROL_DEVICE_ID}', '{CONTROL_CHILD_ID}',
        '53000000-0000-4000-8000-000000000005', 'drift-contract',
        'Kippy', 'Control sentinel', 'active'
    );

insert into public.v2_parental_settings (
    child_id,
    revision,
    daily_screen_time_limit_minutes,
    location_tracking_enabled,
    location_update_interval_minutes,
    home_exit_alert_enabled,
    school_exit_alert_enabled,
    exit_debounce_seconds,
    lost_mode_enabled,
    lost_mode_message,
    created_at,
    updated_at
)
values
    (
        '{TARGET_CHILD_ID}', 41, 137, false, 23, true, true, 333,
        true, 'Preserve target settings',
        '2026-01-02 03:04:05+00', '2026-01-02 03:04:05+00'
    ),
    (
        '{CONTROL_CHILD_ID}', 17, 222, true, 31, false, true, 444,
        false, null,
        '2026-02-03 04:05:06+00', '2026-02-03 04:05:06+00'
    );
commit;
"""
    )

    drift_state = psql.scalar(
        f"""
select
    (select location_tracking_enabled::text || '|' || revision::text
       from public.v2_parental_settings
      where child_id = '{TARGET_CHILD_ID}'),
    (select count(*) from pg_constraint
      where conrelid = 'public.v2_parental_settings'::regclass
        and conname = 'v2_parental_settings_location_tracking_mandatory'),
    (select pg_get_expr(default_row.adbin, default_row.adrelid)
       from pg_attribute attribute_row
       join pg_attrdef default_row
         on default_row.adrelid = attribute_row.attrelid
        and default_row.adnum = attribute_row.attnum
      where attribute_row.attrelid = 'public.v2_parental_settings'::regclass
        and attribute_row.attname = 'location_tracking_enabled'),
    (select count(*) from public.v2_device_commands
      where command_type = 'REFRESH_SETTINGS');
"""
    )
    if drift_state != "false|41|0|false|0":
        raise ContractError(f"failed to reproduce the live drift: {drift_state}")
    print(f"PRE_REPAIR_DRIFT={drift_state}")


def assert_repair(psql: Psql) -> None:
    settings_state = psql.scalar(
        f"""
select concat_ws('|',
    location_tracking_enabled::text,
    revision::text,
    daily_screen_time_limit_minutes::text,
    location_update_interval_minutes::text,
    home_exit_alert_enabled::text,
    school_exit_alert_enabled::text,
    exit_debounce_seconds::text,
    lost_mode_enabled::text,
    lost_mode_message,
    (created_at = '2026-01-02 03:04:05+00'::timestamptz)::text,
    (updated_at > '2026-01-02 03:04:05+00'::timestamptz)::text
)
  from public.v2_parental_settings
 where child_id = '{TARGET_CHILD_ID}';
"""
    )
    expected_settings = (
        "true|42|137|23|true|true|333|true|Preserve target settings|true|true"
    )
    if settings_state != expected_settings:
        raise ContractError(f"target settings were not repaired safely: {settings_state}")

    control_state = psql.scalar(
        f"""
select concat_ws('|',
    location_tracking_enabled::text,
    revision::text,
    daily_screen_time_limit_minutes::text,
    location_update_interval_minutes::text,
    home_exit_alert_enabled::text,
    school_exit_alert_enabled::text,
    exit_debounce_seconds::text,
    lost_mode_enabled::text,
    (lost_mode_message is null)::text,
    (created_at = '2026-02-03 04:05:06+00'::timestamptz)::text,
    (updated_at = '2026-02-03 04:05:06+00'::timestamptz)::text
)
  from public.v2_parental_settings
 where child_id = '{CONTROL_CHILD_ID}';
"""
    )
    expected_control = "true|17|222|31|false|true|444|false|true|true|true"
    if control_state != expected_control:
        raise ContractError(f"unaffected settings changed: {control_state}")

    command_rows = psql.rows(
        f"""
select concat_ws('|',
    device_id::text,
    command_type,
    payload->>'settings_revision',
    status,
    idempotency_key,
    (requested_by is null)::text
)
  from public.v2_device_commands
 where device_id in (
    '{ACTIVE_DEVICE_ID}', '{DEGRADED_DEVICE_ID}',
    '{PENDING_DEVICE_ID}', '{REVOKED_DEVICE_ID}', '{CONTROL_DEVICE_ID}'
 )
 order by device_id;
"""
    )
    expected_commands = [
        (
            f"{ACTIVE_DEVICE_ID}|REFRESH_SETTINGS|42|pending|"
            f"settings:mandatory-location-drift-repair-v1:{TARGET_CHILD_ID}:"
            f"{ACTIVE_DEVICE_ID}|true"
        ),
        (
            f"{DEGRADED_DEVICE_ID}|REFRESH_SETTINGS|42|pending|"
            f"settings:mandatory-location-drift-repair-v1:{TARGET_CHILD_ID}:"
            f"{DEGRADED_DEVICE_ID}|true"
        ),
    ]
    if command_rows != expected_commands:
        raise ContractError(f"unexpected refresh command set: {command_rows}")

    catalog_state = psql.scalar(
        """
select
    (select pg_get_expr(default_row.adbin, default_row.adrelid)
       from pg_attribute attribute_row
       join pg_attrdef default_row
         on default_row.adrelid = attribute_row.attrelid
        and default_row.adnum = attribute_row.attnum
      where attribute_row.attrelid = 'public.v2_parental_settings'::regclass
        and attribute_row.attname = 'location_tracking_enabled'),
    (select convalidated::text
       from pg_constraint
      where conrelid = 'public.v2_parental_settings'::regclass
        and conname = 'v2_parental_settings_location_tracking_mandatory'),
    (select count(*) from public.v2_families
      where id in ('23000000-0000-0000-0000-000000000001',
                   '23000000-0000-0000-0000-000000000002')),
    (select count(*) from public.v2_children
      where id in ('33000000-0000-0000-0000-000000000001',
                   '33000000-0000-0000-0000-000000000002')),
    (select count(*) from public.v2_protected_devices
      where id::text like '43000000-0000-4000-8000-00000000000%'),
    (select string_agg(status, ',' order by id)
       from public.v2_protected_devices
      where id::text like '43000000-0000-4000-8000-00000000000%');
"""
    )
    if catalog_state != "true|true|2|2|5|active,degraded,pending,revoked,active":
        raise ContractError(f"catalog or fixture data changed: {catalog_state}")

    print(f"TARGET_SETTINGS={settings_state}")
    print(f"CONTROL_SETTINGS={control_state}")
    print("REFRESH_SETTINGS_COMMANDS=2|active=1|degraded=1|other=0")
    print(f"CATALOG_AND_DATA={catalog_state}")
    print("MANDATORY_LOCATION_DRIFT_REPAIR_MIGRATION=PASS")


def run_contract(
    psql: Psql,
    supabase: str,
    workdir: Path,
    migration_directory: Path,
) -> None:
    versions = migration_versions(migration_directory)
    if len(versions) != EXPECTED_FULL_MIGRATION_COUNT:
        raise ContractError(
            f"expected {EXPECTED_FULL_MIGRATION_COUNT} migrations, found {len(versions)}"
        )
    if versions[0] != EXPECTED_FIRST_MIGRATION:
        raise ContractError(f"unexpected first migration: {versions[0]}")
    if versions[-2:] != [BASE_MIGRATION_VERSION, REPAIR_MIGRATION_VERSION]:
        raise ContractError(f"unexpected migration tail: {versions[-2:]}")

    base_versions = versions[:-1]
    if len(base_versions) != EXPECTED_BASE_MIGRATION_COUNT:
        raise ContractError("unexpected pre-repair migration count")

    run_reset(supabase, workdir, version=BASE_MIGRATION_VERSION)
    verify_ledger(psql, base_versions, label="pre_repair")
    reproduce_live_drift(psql)

    repair_path = migration_directory / (
        "20260902100000_v2_mandatory_continuous_location_drift_repair.sql"
    )
    psql.run_file(repair_path)
    assert_repair(psql)


def main() -> int:
    args = parse_args()
    workdir = Path(__file__).resolve().parents[2]
    migration_directory = Path(__file__).resolve().parent.parent / "migrations"
    base_reset_completed = False
    failure: Exception | None = None

    try:
        require_loopback(args.host)
        psql = Psql(
            resolve_executable(args.psql),
            args.host,
            args.port,
            args.user,
            args.database,
        )
        supabase = resolve_executable(args.supabase)
        run_contract(psql, supabase, workdir, migration_directory)
        base_reset_completed = True
    except (ContractError, subprocess.TimeoutExpired) as error:
        failure = error
    finally:
        if 'supabase' in locals():
            try:
                run_reset(supabase, workdir, version=None)
                if 'psql' in locals():
                    full_versions = migration_versions(migration_directory)
                    verify_ledger(psql, full_versions, label="restored_full")
                print("LOCAL_DATABASE_RESTORED=PASS")
            except (ContractError, subprocess.TimeoutExpired) as restore_error:
                if failure is None:
                    failure = restore_error
                else:
                    failure = ContractError(
                        f"{failure}; local restore also failed: {restore_error}"
                    )

    if failure is not None:
        print(
            f"MANDATORY_LOCATION_DRIFT_REPAIR_MIGRATION=FAIL: {failure}",
            file=sys.stderr,
        )
        return 1
    if not base_reset_completed:
        print(
            "MANDATORY_LOCATION_DRIFT_REPAIR_MIGRATION=FAIL: base reset not completed",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
