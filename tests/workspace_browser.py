"""Smoke test the production bundle with local Supabase response fixtures."""

import base64
import datetime
import json
import mimetypes
import os
import subprocess
import tempfile
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright

me = "11111111-1111-4111-a111-111111111111"
now = int(time.time())
created = datetime.datetime.now(datetime.UTC).isoformat()


def enc(d):
    return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")


token = (
    enc({"alg": "HS256", "typ": "JWT"})
    + "."
    + enc({"sub": me, "role": "authenticated", "exp": now + 86400})
    + "."
    + enc("fixture")
)
user = {
    "id": me,
    "aud": "authenticated",
    "role": "authenticated",
    "email": "mubarak@example.test",
    "created_at": created,
    "app_metadata": {},
    "user_metadata": {},
}
session = {
    "access_token": token,
    "expires_at": now + 86400,
    "expires_in": 86400,
    "token_type": "bearer",
    "refresh_token": "local-test",
    "user": user,
}
names = [
    "Meeting room display loses signal",
    "New starter needs VPN access",
    "Scanner unavailable at reception",
    "Outlook calendar sync",
    "Laptop dock replacement",
]
tickets = [
    {
        "id": str(uuid.uuid4()),
        "title": names[i % 5],
        "description": "Conference room display drops the HDMI connection.",
        "category": "hardware",
        "status": ["open", "in_progress", "resolved", "closed"][i % 4],
        "priority": "urgent" if i in (4, 5, 6) else ["high", "medium", "low"][i % 3],
        "user_id": me,
        "assigned_to": None,
        "assignee": None,
        "requester": "Salem Ahmad",
        "created_at": (
            datetime.datetime.fromisoformat(created) - datetime.timedelta(hours=i + 1)
        ).isoformat(),
        "updated_at": (
            datetime.datetime.fromisoformat(created) - datetime.timedelta(minutes=i)
        ).isoformat(),
    }
    for i in range(26)
]
comments = []
staff_notes = []
note_requests = []
with tempfile.TemporaryDirectory(prefix="desk-web-") as build, sync_playwright() as p:
    subprocess.run(
        ["npm", "run", "build", "--", "--outDir", build],
        cwd=ROOT,
        check=True,
        env={
            **os.environ,
            "VITE_SUPABASE_URL": "https://deskfixture.supabase.co",
            "VITE_SUPABASE_ANON_KEY": "local-fixture",
        },
    )
    browser = p.chromium.launch(
        executable_path=os.environ.get("CHROMIUM_PATH"),
        args=json.loads(os.environ.get("CHROMIUM_ARGS", "[]")),
    )
    context = browser.new_context(
        viewport={"width": 1400, "height": 950}, reduced_motion="reduce"
    )
    ctxrole = ["admin"]

    def fixture(route):
        req = route.request
        parsed = urlparse(req.url)
        path = parsed.path.split("/")[-1]
        q = parse_qs(parsed.query)
        body = req.post_data_json or {}
        role = ctxrole[0]
        profile = {
            "id": me,
            "full_name": "Mubarak Alshammari",
            "role": role,
            "created_at": created,
        }
        headers = {}
        if req.method == "OPTIONS":
            data = {}
        elif path == "user":
            data = user
        elif path == "profiles":
            if "id" in q:
                data = profile
            else:
                people = [
                    profile,
                    *[
                        dict(
                            profile,
                            id=str(uuid.UUID(int=i + 1)),
                            full_name=f"Technician {i:02d}",
                            role="it",
                        )
                        for i in range(13)
                    ],
                ]
                if "role" in q:
                    people = [
                        member
                        for member in people
                        if member["role"] == q["role"][0].removeprefix("eq.")
                    ]
                if "full_name" in q:
                    term = q["full_name"][0].removeprefix("imatch.***=").lower()
                    people = [
                        member
                        for member in people
                        if term in member["full_name"].lower()
                    ]
                start = int(q.get("offset", ["0"])[0])
                data = people[start : start + int(q.get("limit", ["12"])[0])]
                headers["content-range"] = (
                    f"{start}-{start + len(data) - 1}/{len(people)}" if data else "*/0"
                )
        elif path == "ticket_overview":
            data = {
                s: sum(t["status"] == s for t in tickets)
                for s in ["open", "in_progress", "resolved", "closed"]
            }
            data.update(unassigned=12, today=4, recent=tickets[:5])
        elif path == "ticket_queue":
            rows = [
                t
                for t in tickets
                if any(
                    body["p_search"].casefold() in t[field].casefold()
                    for field in ("title", "description", "requester")
                )
                and (not body["p_status"] or t["status"] == body["p_status"])
                and (not body["p_category"] or t["category"] == body["p_category"])
                and (not body["p_priority"] or t["priority"] == body["p_priority"])
                and (body["p_scope"] != "mine" or t["assigned_to"] == me)
                and (
                    body["p_scope"] != "unassigned"
                    or (
                        t["assigned_to"] is None
                        and t["status"] in ("open", "in_progress")
                    )
                )
                and (
                    body["p_scope"] != "urgent"
                    or (
                        t["priority"] == "urgent"
                        and t["status"] in ("open", "in_progress")
                    )
                )
            ]
            rows.sort(key=lambda t: t["updated_at"], reverse=True)
            if body["p_sort"] == "priority":
                rank = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
                rows.sort(key=lambda t: rank[t["priority"]])
            elif body["p_sort"] == "oldest":
                rows.sort(
                    key=lambda t: (
                        t["status"] not in ("open", "in_progress"),
                        t["created_at"],
                    )
                )
            page = max(1, min((len(rows) + 19) // 20, body["p_page"]))
            data = {
                "total": len(rows),
                "page": page,
                "rows": rows[(page - 1) * 20 : page * 20],
            }
        elif path == "tickets":
            ticket = next(t for t in tickets if t["id"] == q["id"][0][3:])
            if req.method == "PATCH":
                ticket.update(body)
            detail = {
                **ticket,
                "assignee": {"full_name": ticket["assignee"]}
                if ticket["assignee"]
                else None,
            }
            data = (
                detail
                if req.method == "PATCH"
                or "vnd.pgrst.object" in req.headers.get("accept", "")
                else [detail]
            )
        elif path == "audit_activity":
            changes = [
                {
                    "id": "ev1",
                    "created_at": created,
                    "kind": "access",
                    "action": "role_changed",
                    "ticket_id": None,
                    "subject": "On-call engineer",
                    "actor": "Access manager",
                    "before": "employee",
                    "after": "it",
                }
            ]
            if body["p_kind"] not in ("all", "access") or (
                body["p_search"] and body["p_search"].lower() not in "on-call engineer"
            ):
                changes = []
            data = {"rows": changes, "page": 1, "total": len(changes)}
        elif path == "ticket_staff_notes":
            note_requests.append(role)
            data = staff_notes
        elif path == "add_staff_note":
            assert role in ("it", "admin")
            staff_notes.insert(
                0,
                {
                    "id": body["p_note"],
                    "created_at": created,
                    "body": body["p_body"],
                    "author": profile,
                },
            )
            data = body["p_note"]
        elif path == "claim_ticket":
            ticket = next(t for t in tickets if t["id"] == body["p_ticket"])
            ticket.update(assigned_to=me, assignee="Mubarak Alshammari")
            data = me
        elif path == "ticket_comments":
            if req.method == "POST":
                data = {
                    **body,
                    "id": str(uuid.uuid4()),
                    "author": profile,
                    "created_at": created,
                }
                comments.append(data)
            else:
                data = comments
        else:
            data = []
        route.fulfill(
            status=200,
            json=data,
            headers={
                **headers,
                "access-control-expose-headers": "content-range",
                "access-control-allow-origin": "*",
                "access-control-allow-headers": "*",
                "access-control-allow-methods": "*",
            },
        )

    def assets(route):
        name = urlparse(route.request.url).path.lstrip("/")
        file = Path(build) / name
        if not file.is_file():
            file = Path(build) / "index.html"
        route.fulfill(
            path=file,
            content_type=mimetypes.guess_type(str(file))[0]
            or "application/octet-stream",
        )

    context.route("http://127.0.0.1:6234/**", assets)
    context.route("https://deskfixture.supabase.co/**", fixture)
    context.route("https://fonts.**", lambda r: r.abort())
    context.route_web_socket("**/realtime/**", lambda ws: None)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("http://127.0.0.1:6234/login")
    expect(page.get_by_role("heading", name="Sign in")).to_be_visible()
    page.get_by_role("button", name="Create an account").click()
    expect(page.get_by_label("Full name")).to_be_visible()
    page.evaluate(
        '(s)=>localStorage.setItem("sb-deskfixture-auth-token",JSON.stringify(s))',
        session,
    )
    page.goto("http://127.0.0.1:6234/")
    expect(page.get_by_text("26 total")).to_be_visible()
    page.get_by_role("link", name="Ticket queue", exact=True).click()
    expect(page.locator(".ticket-row")).to_have_count(20)
    page.get_by_role("button", name="Urgent & active").click()
    expect(page.locator(".ticket-row")).to_have_count(2)
    page.get_by_label("Sort tickets").select_option("oldest")
    expect(page.locator(".ticket-row").first).to_contain_text(names[0])
    page.get_by_role("button", name="All tickets", exact=True).click()
    page.get_by_label("Sort tickets").select_option("priority")
    expect(page.locator(".ticket-row").first).to_contain_text("Urgent")
    page.get_by_role("button", name="Filters", exact=True).click()
    page.get_by_label("Priority", exact=True).select_option("urgent")
    expect(page.locator(".ticket-row")).to_have_count(3)
    page.get_by_role("button", name="Clear filters").click()
    page.get_by_label("Sort tickets").select_option("recent")
    expect(page.locator(".ticket-row")).to_have_count(20)
    page.get_by_label("Next page").click()
    expect(page.locator(".ticket-row")).to_have_count(6)
    page.get_by_label("Search tickets").fill("Scanner")
    expect(page.locator(".ticket-row")).to_have_count(5)
    page.get_by_label("Search tickets").fill("")
    expect(page.locator(".ticket-row")).to_have_count(20)
    page.locator(".ticket-row").first.click()
    expect(page.get_by_role("heading", name=names[0])).to_be_visible()
    page.get_by_role("button", name="Claim ticket").click()
    expect(page.locator(".assignment strong")).to_have_text("Mubarak Alshammari")
    page.get_by_label("Write a reply").fill("Checking the dock now.")
    page.get_by_role("tab", name="Internal notes").click()
    page.get_by_label("Add an internal note").fill("Hand off to the next shift.")
    page.get_by_role("button", name="Add note", exact=True).click()
    expect(page.get_by_text("Hand off to the next shift.", exact=True)).to_be_visible()
    page.get_by_role("tab", name="Replies").click()
    expect(
        page.get_by_text("Hand off to the next shift.", exact=True)
    ).not_to_be_visible()
    expect(page.get_by_label("Write a reply")).to_have_value("Checking the dock now.")
    page.get_by_role("button", name="Reply", exact=True).click()
    expect(page.get_by_text("Checking the dock now.")).to_be_visible()
    page.get_by_role("group", name="Ticket status").get_by_role(
        "button", name="In progress"
    ).click()
    expect(page.get_by_role("alertdialog")).to_be_visible()
    page.get_by_role("button", name="Apply change").click()
    expect(
        page.get_by_role("group", name="Ticket status").get_by_role(
            "button", name="In progress"
        )
    ).to_have_attribute("aria-pressed", "true")
    page.get_by_label("Close ticket panel").click()
    page.get_by_role("button", name="Assigned to me").click()
    expect(page.locator(".ticket-row")).to_have_count(1)
    page.get_by_label("Switch to dark mode").click()
    expect(page.locator("html")).to_have_class("dark")
    page.get_by_role("link", name="Audit trail").click()
    expect(page.get_by_role("heading", name="Audit trail")).to_be_visible()
    expect(page.get_by_text("On-call engineer")).to_be_visible()
    page.get_by_label("Activity type").select_option("account")
    expect(page.get_by_role("heading", name="No matching activity")).to_be_visible()
    page.get_by_role("link", name="Team directory").click()
    expect(page.get_by_role("heading", name="Team directory")).to_be_visible()
    page.get_by_label("Next directory page").click()
    expect(page.get_by_text("Technician 12", exact=True)).to_be_visible()
    page.get_by_label("Filter by role").select_option("it")
    page.get_by_label("Search team members").fill("Technician 01")
    expect(page.get_by_text("Technician 01", exact=True)).to_be_visible()
    expect(page.get_by_text("Technician 02", exact=True)).to_have_count(0)
    page.get_by_role("button", name="New ticket", exact=True).click()
    form = page.get_by_role("dialog", name="New ticket")
    expect(form).to_be_visible()
    form.get_by_text("Network", exact=True).click()
    expect(form.get_by_role("radio", name="Network")).to_be_checked()
    expect(form.get_by_label("Title")).to_have_attribute(
        "placeholder", "Office Wi-Fi drops during calls"
    )
    form.get_by_label("Priority").select_option("high")
    expect(
        form.get_by_text("Someone is blocked from completing important work.")
    ).to_be_visible()
    form.get_by_role("button", name="Create ticket").click()
    expect(form.get_by_label("Title")).to_be_focused()
    expect(
        form.get_by_text("Use 10 to 2,000 characters to describe the request.")
    ).to_be_visible()
    page.get_by_role("radio", name="Network").check()
    page.get_by_label("Priority").select_option("urgent")
    expect(
        page.get_by_text("An essential service is down or several people are blocked.")
    ).to_be_visible()
    page.keyboard.press("Escape")
    expect(page.get_by_role("dialog")).to_have_count(0)
    page.set_viewport_size({"width": 390, "height": 844})
    ctxrole[0] = "employee"
    page.goto("http://127.0.0.1:6234/tickets")
    expect(page.get_by_role("heading", name="My requests")).to_be_visible()
    page.get_by_role("button", name="Open menu").click()
    expect(page.get_by_role("link", name="Overview")).to_be_visible()
    page.keyboard.press("Escape")
    page.locator(".ticket-row").first.click()
    expect(page.get_by_role("heading", name=names[0])).to_be_visible()
    expect(page.get_by_role("button", name="Claim ticket")).to_have_count(0)
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.emulate_media(reduced_motion="no-preference")
    page.goto("http://127.0.0.1:6234/tickets")
    expect(page.get_by_role("heading", name="My requests")).to_be_visible()
    assert (
        page.locator(".workspace-main").evaluate(
            "el => getComputedStyle(el).animationName"
        )
        == "page-enter"
    )
    page.emulate_media(reduced_motion="reduce")
    assert (
        page.locator(".workspace-main").evaluate(
            "el => getComputedStyle(el).animationName"
        )
        == "none"
    )
    assert "employee" not in note_requests and "admin" in note_requests
    assert not errors, errors
    print(
        "PASS: sign-up view, dashboard, 20-row pagination, search, detail, claim, reply, scope, dark mode, audit, users, dialogs, employee mobile navigation, mobile overflow."
    )
    browser.close()
