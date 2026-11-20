"""Run against a disposable PostgreSQL cluster. Requires pgserver and psycopg2-binary."""

import concurrent.futures
import json
import socket
import subprocess
import tempfile
import threading
import uuid
from contextlib import closing, contextmanager
from pathlib import Path

import pgserver
import psycopg2

ROOT = Path(__file__).resolve().parents[1]
BIN = Path(pgserver.__file__).parent / "pginstall" / "bin"


@contextmanager
def local_database():
    with tempfile.TemporaryDirectory(prefix="helpdesk-test-") as directory:
        cluster = Path(directory) / "data"
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]

        def run(binary, *args):
            subprocess.run([BIN / binary, *args], check=True, stdout=subprocess.DEVNULL)

        run(
            "initdb",
            "-D",
            cluster,
            "-U",
            "postgres",
            "-A",
            "trust",
            "--no-locale",
            "-E",
            "UTF8",
        )
        run(
            "pg_ctl",
            "-D",
            cluster,
            "-l",
            Path(directory) / "postgres.log",
            "-o",
            f"-p {port} -h 127.0.0.1 -c unix_socket_directories='' -c wal_level=logical",
            "-w",
            "start",
        )
        try:
            yield f"host=127.0.0.1 port={port} dbname=postgres user=postgres"
        finally:
            run("pg_ctl", "-D", cluster, "-m", "fast", "-w", "stop")


def prepare(cursor):
    cursor.execute("""
        create role authenticated;
        create role anon;
        create schema auth;
        create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
        create function auth.uid() returns uuid language sql stable as $$
          select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        create function auth.role() returns text language sql stable as $$
          select current_setting('request.jwt.claim.role',true) $$;
        grant usage on schema auth to authenticated, anon;
        create publication supabase_realtime;
    """)
    for migration in sorted((ROOT / "supabase/migrations").glob("*.sql")):
        if migration.name >= "0008":
            continue
        # This distribution includes gen_random_uuid in core, but ships no pgcrypto.control.
        sql = migration.read_text().replace(
            "create extension if not exists pgcrypto;", "select gen_random_uuid();"
        )
        cursor.execute(sql)


def exercise(dsn):
    employee, other, first_agent, second_agent, admin = [
        str(uuid.uuid4()) for _ in range(5)
    ]
    with closing(psycopg2.connect(dsn)) as setup, setup.cursor() as cursor:
        setup.autocommit = True
        prepare(cursor)
        for person, name, role in [
            (employee, "Mubarak", "employee"),
            (other, "Salem", "employee"),
            (first_agent, "Dana", "it"),
            (second_agent, "Ali", "it"),
            (admin, "Sam", "admin"),
        ]:
            cursor.execute(
                "insert into auth.users values (%s,%s)",
                (person, json.dumps({"full_name": name})),
            )
            cursor.execute("update profiles set role=%s where id=%s", (role, person))
        cursor.execute(
            """insert into tickets(user_id,title,description,category)
            select %s,'Printer issue '||i,'Morning office checklist','hardware'
            from generate_series(1,1045) i returning id""",
            (employee,),
        )
        ticket = cursor.fetchone()[0]
        cursor.execute(
            "insert into tickets(user_id,title,description,category) values(%s,'VPN login','Cannot log into VPN','network')",
            (other,),
        )

        cursor.execute(
            (ROOT / "supabase/migrations/0008_ticket_workspace.sql").read_text()
        )

    def query(person, sql, args=()):
        with (
            closing(psycopg2.connect(dsn)) as connection,
            connection,
            connection.cursor() as cursor,
        ):
            cursor.execute("set local role authenticated")
            cursor.execute(
                "select set_config('request.jwt.claim.sub',%s,true),set_config('request.jwt.claim.role','authenticated',true)",
                (person,),
            )
            cursor.execute(sql, args)
            return cursor.fetchone()[0] if cursor.description else None

    def queue(person, search="", status=None, category=None, scope="all", page=1):
        return query(
            person,
            "select ticket_queue(%s,%s,%s,%s,%s)",
            (search, status, category, scope, page),
        )

    def expect_denied(person, sql, args):
        try:
            query(person, sql, args)
        except psycopg2.errors.InsufficientPrivilege:
            return
        raise AssertionError("Expected a permission error")

    last_page = queue(employee, page=99)
    assert last_page["page"] == 53 and len(last_page["rows"]) == 5
    assert queue(other, search="Morning")["total"] == 0
    assert queue(first_agent, search="Salem", category="network")["total"] == 1
    assert queue(first_agent, search="%")["total"] == 0
    assert (
        query(employee, "select ticket_overview(current_date,current_date+1)")["today"]
        == 1045
    )
    expect_denied(employee, "select claim_ticket(%s)", (ticket,))
    expect_denied(
        first_agent,
        "update tickets set assigned_to=%s where id=%s",
        (second_agent, ticket),
    )
    start = threading.Barrier(2)

    def claim(person):
        start.wait(timeout=10)
        return query(person, "select claim_ticket(%s)", (ticket,))

    with concurrent.futures.ThreadPoolExecutor(2) as workers:
        winners = list(workers.map(claim, [first_agent, second_agent]))
    holder = winners[0]
    assert holder in (first_agent, second_agent) and winners[1] == holder
    assert query(holder, "select claim_ticket(%s)", (ticket,)) == holder
    assert queue(holder, scope="mine")["total"] == 1
    assert queue(holder, scope="unassigned")["total"] == 1045
    assert (
        query(
            admin,
            "select count(*) from ticket_history where action='assigned_to_changed'",
        )
        == 1
    )
    before = query(holder, "select updated_at from tickets where id=%s", (ticket,))
    query(
        employee,
        "insert into ticket_comments(user_id,ticket_id,body) values(%s,%s,'Power is back.')",
        (employee, ticket),
    )
    assert (
        query(holder, "select updated_at from tickets where id=%s", (ticket,)) > before
    )
    query(admin, "select set_user_role(%s,'employee')", (holder,))
    assert (
        query(admin, "select assigned_to from tickets where id=%s", (ticket,)) is None
    )


if __name__ == "__main__":
    with local_database() as url:
        exercise(url)
    print("Workspace database checks passed.")
