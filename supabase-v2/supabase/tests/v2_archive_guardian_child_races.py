"""Root-operated synthetic concurrency contract. Requires the disposable migrated DB.

No external services, model calls, email, or production credentials. Seed rows are
committed only in the pinned disposable database and retained for root inspection.
Usage: python v2_archive_guardian_child_races.py [--output-dir NEW_DIRECTORY]
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import uuid

PSQL = "C:/tmp/kippy-pg17-runtime/pgsql/bin/psql.exe"
ARGS = [PSQL, "-X", "-w", "-qAt", "-h", "127.0.0.1", "-p", "57449", "-U", "postgres",
        "-d", "kippy_child_management", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate"]
GUARD = """do $$ begin
 if current_database()<>'kippy_child_management' or inet_server_addr() is distinct from '127.0.0.1'::inet
 or inet_server_port() is distinct from 57449 then raise exception 'disposable_database_required'; end if;
end $$;
set statement_timeout='15s';
"""


class Failure(Exception):
    pass


def require(value, code):
    if not value:
        raise Failure(code)


class Runner:
    def __init__(self, output):
        self.output, self.number, self.sessions = output, 0, []
        self.env = {key: value for key, value in os.environ.items() if not key.upper().startswith("PG")}
        # Ignore the user's default password file as well as inherited PG* settings.
        self.env["PGPASSFILE"] = str(output / "no-password-file")

    def start(self, sql, hold=False):
        self.number += 1
        app = "archive_race_" + uuid.uuid4().hex
        path = self.output / (str(self.number).zfill(3) + ".log")
        stream = path.open("wb")
        process = subprocess.Popen(ARGS, stdin=subprocess.PIPE, stdout=stream, stderr=subprocess.STDOUT,
            env=self.env, creationflags=0x08000000)
        session = {"process": process, "stream": stream, "path": path, "app": app}
        self.sessions.append(session)
        prefix = GUARD + "set application_name='" + app + "';\n"
        process.stdin.write((prefix + sql + ("\nselect 'RACE_READY';\n" if hold else "\n\\q\n")).encode())
        process.stdin.flush()
        if not hold:
            process.stdin.close()
        return session

    def wait(self, session, expected="00000"):
        process = session["process"]
        code = process.wait(timeout=20)
        session["stream"].close()
        value = session["path"].read_text(encoding="utf-8", errors="replace")
        require(code == 0 if expected == "00000" else code != 0 and re.search(r"\bERROR:\s+" + expected + r"\b", value),
                "SQL_RESULT_MISMATCH")
        return value.strip()

    def query(self, sql):
        return self.wait(self.start(sql))

    def ready(self, session):
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            require(session["process"].poll() is None, "BLOCKER_EXITED_BEFORE_READY")
            if "RACE_READY" in session["path"].read_text(encoding="utf-8", errors="replace"):
                return
            time.sleep(0.03)
        raise Failure("BLOCKER_READY_TIMEOUT")

    def blocked(self, waiter, blocker):
        # Observable PostgreSQL wait and the exact blocking PID, not a timed guess.
        sql = """select count(*) from pg_stat_activity w join pg_stat_activity b
          on b.pid=any(pg_blocking_pids(w.pid))
          where w.application_name='%s' and b.application_name='%s'
          and w.wait_event_type='Lock';""" % (waiter["app"], blocker["app"])
        deadline = time.monotonic() + 6
        while time.monotonic() < deadline:
            require(waiter["process"].poll() is None, "WAITER_EXITED_BEFORE_LOCK_PROOF")
            if self.query(sql) == "1":
                return
            time.sleep(0.02)
        raise Failure("DATABASE_LOCK_WAIT_NOT_OBSERVED")

    def release(self, session):
        session["process"].stdin.write(b"commit;\n\\q\n")
        session["process"].stdin.close()
        self.wait(session)

    def close(self):
        for session in self.sessions:
            process = session["process"]
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=5)
            session["stream"].close()


def seed(runner):
    values = {key: str(uuid.uuid4()) for key in ("guardian", "family", "child", "session", "device", "installation")}
    runner.query("""begin;
      insert into auth.users(id) values('{guardian}');
      insert into public.v2_families(id,display_name) values('{family}','Synthetic archive race family');
      insert into public.v2_guardian_memberships(family_id,guardian_user_id,role,status)
        values('{family}','{guardian}','owner','active');
      insert into public.v2_children(id,family_id,display_name) values('{child}','{family}','Synthetic archive race child');
      insert into public.v2_protected_devices(id,child_id,installation_id,app_version,status)
        values('{device}','{child}','{installation}','synthetic-archive-race','active');
      insert into public.v2_device_credentials(device_id,credential_hash,key_version,expires_at)
        values('{device}',repeat('a',64),1,now()+interval '1 day');
      insert into public.v2_child_install_sessions(id,child_id,created_by,activation_token_hash,status,activated_at,expires_at)
        values('{session}','{child}','{guardian}',replace('{session}','-','')||replace('{session}','-',''),
        'activated',now(),now()+interval '15 minutes');
      insert into public.v2_device_commands(device_id,command_type,payload,idempotency_key,expires_at)
        values('{device}','REFRESH_SETTINGS','{{}}','synthetic-race-{child}',now()+interval '1 hour');
      commit;""".format(**values))
    return values


def archive(values):
    return """set local role authenticated;
      select set_config('request.jwt.claim.sub','{guardian}',true);
      select * from public.v2_archive_guardian_child('{child}','race-archive-{child}');""".format(**values)


def registration(values, complete=False):
    args = "'{guardian}'," + ("" if complete else "'{child}',")
    return ("select * from public." + ("v2_complete_child_install_service" if complete else "v2_register_device_service")
        + "(" + args + "'" + str(uuid.uuid4()) + "','synthetic-race',2::smallint,'test','test',"
        + "repeat('b',64),now()+interval '1 day');").format(**values)


def snapshot(runner, values):
    return runner.query("""select jsonb_build_array(
      (select status from public.v2_children where id='{child}'),
      (select count(*) from public.v2_protected_devices where child_id='{child}' and status<>'revoked'),
      (select count(*) from public.v2_device_credentials c join public.v2_protected_devices d on d.id=c.device_id
        where d.child_id='{child}' and c.revoked_at is null),
      (select count(*) from public.v2_child_install_sessions where child_id='{child}' and status in ('created','activated')),
      (select count(*) from public.v2_device_commands c join public.v2_protected_devices d on d.id=c.device_id
        where d.child_id='{child}' and c.status in ('pending','claimed')),
      (select count(*) from public.v2_audit_events where object_id='{child}' and action='v2.child.archive'));""".format(**values))


def archived(runner, values):
    require(json.loads(snapshot(runner, values)) == ["archived", 0, 0, 0, 0, 1], "ARCHIVE_INVARIANT_FAILED")


def begin_analysis(values):
    return """select * from public.v2_begin_ephemeral_incident_analysis_service(
      '{device}','{incident_client}','bullying','high','target',0.9::real,0.9::real,to_timestamp({observed}),
      2::smallint,3::smallint,1::bigint,1,1::smallint,to_timestamp({expires}),repeat('d',64),120);""".format(**values)


def receipt_unleased(runner, values):
    require(runner.query("""select count(*) from public.v2_ephemeral_incident_receipts r
      join public.v2_safety_incidents i on i.id=r.incident_id
      where i.device_id='{device}' and i.client_incident_id='{incident_client}'
      and r.state='received' and r.lease_token_hash is null and r.lease_expires_at is null;""".format(**values)) == "1",
      "EPHEMERAL_LEASE_RESURRECTED")


def ephemeral_races(runner, checks):
    for order in ("BEGIN_FIRST", "ARCHIVE_FIRST_RETRY"):
        values = seed(runner)
        values.update(incident_client=str(uuid.uuid4()), observed=int(time.time())-1, expires=int(time.time())+3600)
        if order == "BEGIN_FIRST":
            first = runner.start("begin;" + begin_analysis(values), hold=True)
            runner.ready(first)
            second = runner.start("begin;" + archive(values) + "commit;")
        else:
            # Real previous begin/release creates the exact retained retry receipt.
            # With the old unguarded active read, this retry can lease it while an
            # archive transaction is still uncommitted, surviving its cleanup.
            runner.query("""select public.v2_release_ephemeral_incident_analysis_service(b.incident_id,b.lease_token)
              from (""" + begin_analysis(values).rstrip(";") + ") b;")
            receipt_unleased(runner, values)
            first = runner.start("begin;" + archive(values), hold=True)
            runner.ready(first)
            second = runner.start(begin_analysis(values))
        runner.blocked(second, first)
        runner.release(first)
        runner.wait(second, "00000" if order == "BEGIN_FIRST" else "42501")
        archived(runner, values)
        receipt_unleased(runner, values)
        checks.append({"name": "EPHEMERAL_" + order, "status": "PASSED"})


def execute(runner, checks):
    values = seed(runner)
    first = runner.start("begin;" + registration(values, complete=True), hold=True)
    runner.ready(first)
    second = runner.start("begin;" + archive(values) + "commit;")
    runner.blocked(second, first)
    runner.release(first)
    runner.wait(second)
    archived(runner, values)
    require(runner.query("select count(*) from public.v2_protected_devices where child_id='%s';" % values["child"]) == "2",
            "COMPLETION_DID_NOT_REGISTER_DEVICE")
    checks.append({"name": "REGISTRATION_FIRST", "status": "PASSED"})

    for operation in ("REGISTRATION", "SESSION_CREATE"):
        values = seed(runner)
        first = runner.start("begin;" + archive(values), hold=True)
        runner.ready(first)
        sql = registration(values) if operation == "REGISTRATION" else (
            "select * from public.v2_create_child_install_session_service('{guardian}','" + str(uuid.uuid4())
            + "','{child}',repeat('c',64),now()+interval '10 minutes');").format(**values)
        second = runner.start(sql)
        runner.blocked(second, first)
        runner.release(first)
        runner.wait(second, "42501")
        archived(runner, values)
        checks.append({"name": "ARCHIVE_FIRST_" + operation, "status": "PASSED"})

    for table in ("v2_child_install_sessions", "v2_pairing_sessions"):
        values = seed(runner)
        before = snapshot(runner, values)
        first = runner.start("begin;lock table public." + table + " in row share mode;", hold=True)
        runner.ready(first)
        started = time.monotonic()
        second = runner.start("begin;" + archive(values) + "commit;")
        runner.blocked(second, first)
        runner.wait(second, "55P03")
        require(time.monotonic() - started < 8, "LOCK_TIMEOUT_NOT_BOUNDED")
        require(snapshot(runner, values) == before, "TIMEOUT_CHANGED_STATE")
        runner.release(first)
        runner.query("begin;" + archive(values) + "commit;")
        archived(runner, values)
        checks.append({"name": "BOUNDED_WAIT_" + table.upper(), "status": "PASSED"})
    ephemeral_races(runner, checks)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    output = args.output_dir or Path(tempfile.mkdtemp(prefix="kippy-archive-races-"))
    if args.output_dir:
        output.mkdir(parents=True, exist_ok=False)
    runner, checks = Runner(output), []
    report = {"schema": "V2_ARCHIVE_RACES_V1", "status": "FAILED", "checks": checks}
    try:
        execute(runner, checks)
        report["status"] = "PASSED"
    except Exception as error:
        report["failure"] = str(error) if isinstance(error, Failure) else "HOST_OR_SQL_OPERATION_FAILED"
    finally:
        runner.close()
        (output / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report))
    return 0 if report["status"] == "PASSED" else 1


if __name__ == "__main__":
    raise SystemExit(main())
