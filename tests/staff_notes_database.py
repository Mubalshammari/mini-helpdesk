"""Exercise internal note reads, retries and privacy on a disposable Postgres cluster."""

import concurrent.futures
import json
import threading
import uuid
from contextlib import closing

import psycopg2
from workspace_database import ROOT, local_database, prepare


def exercise(dsn):
    employee, agent, admin = [str(uuid.uuid4()) for _ in range(3)]
    with closing(psycopg2.connect(dsn)) as setup, setup.cursor() as cursor:
        setup.autocommit = True
        prepare(cursor)
        for migration in sorted((ROOT / "supabase/migrations").glob("*.sql")):
            if migration.name >= "0008":
                cursor.execute(migration.read_text())

        for person, role in [(employee, "employee"), (agent, "it"), (admin, "admin")]:
            cursor.execute(
                "insert into auth.users values (%s, %s)",
                (person, json.dumps({"full_name": role})),
            )
            cursor.execute("update profiles set role=%s where id=%s", (role, person))

        cursor.execute(
            """insert into tickets(user_id,title,description,category)
               values (%s,'Broken scanner','The scanner is not responding.','hardware') returning id""",
            (employee,),
        )
        ticket = cursor.fetchone()[0]

    def query(person, sql, args=()):
        with closing(psycopg2.connect(dsn)) as db, db, db.cursor() as cursor:
            if person:
                cursor.execute("set local role authenticated")
                cursor.execute(
                    """select set_config('request.jwt.claim.sub',%s,true),
                       set_config('request.jwt.claim.role','authenticated',true)""",
                    (person,),
                )
            else:
                cursor.execute("set local role anon")
            cursor.execute(sql, args)
            return cursor.fetchone()[0] if cursor.description else None

    add = "select add_staff_note(%s,%s,%s)"
    count = "select count(*) from ticket_staff_notes where ticket_id=%s"

    def denied(person, sql, args=()):
        try:
            query(person, sql, args)
        except psycopg2.errors.InsufficientPrivilege:
            return
        raise AssertionError("Expected access to be denied")

    def public_activity():
        return query(
            employee,
            """select jsonb_build_array(
               (select updated_at from tickets where id=%s),
               (select count(*) from ticket_comments where ticket_id=%s),
               (select count(*) from notifications where ticket_id=%s)
            )""",
            (ticket, ticket, ticket),
        )

    snapshot = public_activity()
    note = str(uuid.uuid4())
    payload = (ticket, note, "  Replacement requested.  ")
    denied(None, count, (ticket,))
    denied(None, add, payload)
    denied(employee, add, payload)
    denied(
        agent,
        "insert into ticket_staff_notes(id,ticket_id,author_id,body) values (%s,%s,%s,'spoof')",
        (note, ticket, admin),
    )
    common_start = threading.Barrier(2)

    def retry(_):
        common_start.wait(timeout=10)
        return query(agent, add, payload)

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(retry, range(2))) == [note, note]
    assert query(agent, count, (ticket,)) == 1 and query(admin, count, (ticket,)) == 1
    assert query(employee, count, (ticket,)) == 0
    assert (
        query(admin, "select body from ticket_staff_notes where id=%s", (note,))
        == "Replacement requested."
    )
    assert (
        query(admin, "select author_id from ticket_staff_notes where id=%s", (note,))
        == agent
    )
    denied(agent, "update ticket_staff_notes set body='replaced' where id=%s", (note,))
    denied(admin, "delete from ticket_staff_notes where id=%s", (note,))
    assert snapshot == public_activity()

    for value in [" \n\t ", "x" * 2001]:
        try:
            query(agent, add, (ticket, str(uuid.uuid4()), value))
        except psycopg2.errors.InvalidParameterValue:
            continue
        raise AssertionError("Expected invalid note content to be rejected")

    for index in range(18):
        query(agent, add, (ticket, str(uuid.uuid4()), f"Work log {index}"))
    common_start = threading.Barrier(2)

    def last_slot(_):
        common_start.wait(timeout=10)
        try:
            query(agent, add, (ticket, str(uuid.uuid4()), "Last note this hour"))
            return True
        except psycopg2.errors.RaiseException as error:
            assert "20 internal notes per hour" in str(error)
            return False

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(last_slot, range(2))) == [False, True]
    assert query(agent, add, payload) == note
    assert query(admin, count, (ticket,)) == 20
    assert public_activity() == snapshot
    assert (
        query(
            admin, "select count(*) from ticket_history where ticket_id=%s", (ticket,)
        )
        == 0
    )
    query(admin, "select set_user_role(%s,'employee')", (agent,))
    assert query(agent, count, (ticket,)) == 0
    denied(agent, add, payload)
    query(admin, "select delete_user_account(%s)", (agent,))
    assert query(admin, count, (ticket,)) == 20
    assert (
        query(admin, "select author_id from ticket_staff_notes where id=%s", (note,))
        is None
    )


if __name__ == "__main__":
    with local_database() as url:
        exercise(url)
    print("Staff note database checks passed.")
