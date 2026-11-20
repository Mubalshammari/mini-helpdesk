"""Verify user-visible audit history in an isolated database with the real policies."""

import json
import uuid
from contextlib import closing

import psycopg2
from workspace_database import ROOT, local_database, prepare


def check(dsn):
    employee, agent, admin, target = [str(uuid.uuid4()) for _ in range(4)]
    with closing(psycopg2.connect(dsn)) as connection, connection.cursor() as cursor:
        connection.autocommit = True
        prepare(cursor)
        for migration in sorted((ROOT / "supabase/migrations").glob("*.sql")):
            if migration.name >= "0008":
                cursor.execute(migration.read_text())
        for person, name, role in [
            (employee, "Requester", "employee"),
            (agent, "Support Agent", "it"),
            (admin, "Access Manager", "admin"),
            (target, "Temporary Agent", "it"),
        ]:
            cursor.execute(
                "insert into auth.users values (%s,%s)",
                (person, json.dumps({"full_name": name})),
            )
            cursor.execute("update profiles set role=%s where id=%s", (role, person))
        cursor.execute(
            "insert into tickets(user_id,title,description,category) values(%s,'Network access','Office issue','network') returning id",
            (employee,),
        )
        ticket = cursor.fetchone()[0]
        cursor.execute(
            """insert into ticket_history(ticket_id, actor_id, action, old_value, new_value)
                          select %s,%s,'status_changed','"open"','"in_progress"' from generate_series(1,26)""",
            (ticket, agent),
        )
        cursor.execute(
            """insert into ticket_history(ticket_id,actor_id,action,new_value)
                          values (%s,%s,'assigned_to_changed',to_jsonb(%s::uuid))""",
            (ticket, agent, agent),
        )
        cursor.execute(
            "insert into role_history(target_id,actor_id,old_role,new_role) values(%s,%s,'employee','it')",
            (target, admin),
        )
        cursor.execute(
            """insert into account_deletions(deleted_user_id,deleted_full_name,deleted_role,actor_id,actor_full_name)
                          values (%s,'Past member','employee',%s,'Access Manager')""",
            (str(uuid.uuid4()), admin),
        )

        def activity(person, search="", kind="all", since=None, page=1):
            cursor.execute("reset role")
            cursor.execute("set role authenticated")
            cursor.execute(
                "select set_config('request.jwt.claim.sub',%s,false),set_config('request.jwt.claim.role','authenticated',false)",
                (person,),
            )
            cursor.execute(
                "select audit_activity(%s,%s,%s,%s)", (search, kind, since, page)
            )
            return cursor.fetchone()[0]

        assert activity(employee)["total"] == 0
        assert (
            activity(agent, kind="account")["total"]
            == activity(agent, kind="access")["total"]
            == 0
        )
        assert activity(agent)["total"] == 27
        assert activity(admin)["total"] == 29
        assert activity(admin, "past member")["rows"][0]["actor"] == "Access Manager"
        assert activity(admin, kind="access")["rows"][0]["after"] == "it"
        entry = activity(agent, "assignment")["rows"][0]
        assert entry["before"] == "Unassigned" and entry["after"] == "Support Agent"
        assert activity(admin, since="2999-01-01")["total"] == 0
        assert activity(admin, search="%")["total"] == 0
        first, last = activity(admin), activity(admin, page=100)
        assert last["page"] == 2 and len(last["rows"]) == 4
        assert {x["id"] for x in first["rows"]}.isdisjoint(
            x["id"] for x in last["rows"]
        )
        cursor.execute("reset role")
        cursor.execute("set role anon")
        try:
            cursor.execute("select audit_activity()")
        except psycopg2.errors.InsufficientPrivilege:
            pass
        else:
            raise AssertionError("Anonymous audit read should be denied")


if __name__ == "__main__":
    with local_database() as dsn:
        check(dsn)
    print("Audit visibility, search, account history and pagination checks passed.")
