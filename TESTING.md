# Manual test checklist

A hands-on smoke test of every feature. Nothing here is automated - it's the
list to walk through by hand before showing the project off or deploying it.
Treat unchecked boxes as unverified, not as known-broken.

## 0. Prerequisites

- [ ] All eleven migrations applied in order (`0001` → `0011`) in the Supabase
      SQL Editor, each returning success.
- [ ] Email confirmation enabled (Authentication → Providers → Email).
- [ ] `.env` filled in with your project URL + anon key.
- [ ] At least one account promoted to `admin` via SQL (see the README's
      "Create the first admin"). Create a couple of extra accounts too so you
      can test roles: one you'll leave as `employee`, one you'll make `it`.
- [ ] `npm install && npm run dev` serves the app without console errors.

---

## 1. Auth & roles

- [ ] Sign up with a real email → "check your email" screen appears.
- [ ] Confirm via the emailed link, then sign in → lands on the Dashboard.
- [ ] Sign in with a wrong password → a clear error toast, no crash.
- [ ] The sidebar shows only what the role should see:
  - **employee**: Dashboard, Tickets (no Audit log, no Users).
  - **it**: Dashboard, Tickets, Audit log (no Users).
  - **admin**: Dashboard, Tickets, Audit log, Users.
- [ ] The top bar shows your name and a role badge (Employee / IT Support /
      Administrator) in the right color.

## 2. Tickets (employee)

- [ ] "+ New Ticket" (sidebar) opens the modal from any page.
- [ ] Create a ticket, choosing a **priority** yourself (Low → Urgent).
- [ ] On submit you land directly on the new ticket's detail page.
- [ ] The employee's **Tickets** page shows only their own tickets, as cards.
- [ ] The status filter chips show correct per-status counts.
- [ ] Try to submit a ticket with a 3-character title → blocked client-side
      with a validation message.
- [ ] Rapidly submit 6 tickets in an hour → the 6th is rejected server-side
      with the rate-limit message (proves the RPC guard, not just the UI).

## 3. Ticket detail & the STATUS PILL SYSTEM

- [ ] As an **employee** viewing your own open ticket: you can edit the
      title/description (pencil icon), and the status pills render **read-only**
      (no click, current status filled, others outlined). Confirm clicking a
      pill does nothing.
- [ ] As **it/admin** on any ticket: clicking an inactive status pill opens a
      confirm dialog; confirming flips the pill with a pop animation, shows a
      toast, and the status timeline advances.
- [ ] As **it/admin**: the smaller priority pills appear and work the same way
      (confirm dialog → change).
- [ ] The change lands in the **Audit log** (who / what / old → new / when).
- [ ] Breadcrumb: the back arrow and "Tickets" link both return correctly.
- [ ] Post a reply on the thread; an **it/admin** reply is tagged "IT Support".
- [ ] Post 21 replies in an hour → the 21st is rejected (comment rate limit).

## 4. LIVE SYNC (two clients side by side)

Open the app in two windows signed in as **different** users (e.g. an admin in
one, the ticket's owner in the other), both on the same ticket or list.

- [ ] Admin changes the ticket's status via the pills → within a second or two
      the **other** client's view updates on its own, no reload.
- [ ] Owner posts a reply → it appears on the admin's thread automatically.
- [ ] Create a new ticket as the employee → it shows up in the admin's IT queue
      live.

## 5. Refresh button + reconnect

- [ ] The top-bar **Refresh** icon spins while loading and a
      "Updated HH:MM" timestamp appears next to it afterward.
- [ ] Refresh works even with Realtime off: kill your network, click Refresh
      (it'll fail/spin), restore network, click again → data + timestamp update.
      This proves Refresh is independent of the realtime channel.
- [ ] Drop the network for ~10s → a subtle "Reconnecting…" (or "Offline") pill
      appears in the top bar; restore it → the pill clears and the current page
      refetches to catch up on anything missed.

## 6. Notifications (bell + sound)

- [ ] With an **it/admin** client open, have an employee file a ticket → the
      bell gets an unread badge and a **three-note rising** sound plays.
- [ ] Reply on a ticket the other user is on → they get a bell notification and
      a softer **two-note** sound (distinct from the new-ticket sound).
- [ ] Click a notification → it marks read and navigates to that ticket.
- [ ] "Mark all read" clears the unread badge.
- [ ] (Browsers block audio before the first interaction; click anywhere in the
      app once, then re-test the sound.)

## 7. Admin · Users (roles + deletion)

- [ ] The Users page lists everyone with a role selector.
- [ ] Change an employee to `it` → confirm dialog → role updates, toast, and a
      row lands in `role_history`.
- [ ] Your **own** row's role selector and delete button are disabled ("You").
- [ ] The delete (trash) button is **disabled for any admin** row with a
      tooltip telling you to demote first (mirrors the server guard).
- [ ] Delete a throwaway **employee** account → danger confirm → the account,
      their tickets, and their replies are gone; an `account_deletions` row
      records who deleted whom.
- [ ] Try to delete an admin (e.g. via a crafted request, if you're testing the
      backend): the RPC rejects it with "Admins cannot be deleted."

## 8. Design & responsiveness

- [ ] Dark-mode toggle flips the whole app; no section stays light mid-page.
      Background is warm (stone), not harsh white.
- [ ] Collapse the sidebar (chevron) → it shrinks to an icon rail; the choice
      persists across reloads.
- [ ] Narrow the window to phone width → the sidebar becomes a hamburger
      drawer; nothing overflows horizontally.
- [ ] Loading skeletons appear on first load of lists/detail; empty states show
      when there's no data.
- [ ] The browser tab title changes per page ("Dashboard · Mini Helpdesk", the
      ticket's own title on detail, etc.).

## 9. Desktop app (Electron)

Build on Windows: `npm install` (let the Electron binary download), then
`npm run build:desktop`. Two files land in `release/`.

- [ ] **`Mini-Helpdesk-Setup-<version>.exe`** (NSIS installer) runs the full
      wizard: license-agreement page → install-for-me/all-users → choose
      folder → install → finish page with "run now". Desktop + Start-menu
      shortcuts appear; it shows up in Add/Remove Programs.
- [ ] The installed app opens, loads the UI (no white flash), and you can sign
      in and use tickets exactly like the web app.
- [ ] **`Mini-Helpdesk-Portable-<version>.exe`** runs with no install and works
      the same.
- [ ] Make a change in one client (web or desktop) → it syncs to the other,
      because both hit the same Supabase project.
- [ ] `dev:desktop`: `npm run dev:desktop` opens an Electron window with HMR
      against the dev server.
- [ ] Security spot-checks: an external link (if any) opens in your real
      browser, not inside the app window; DevTools console shows no CSP
      violations for the app's own resources.
- [ ] (Optional) Set `APP_MODE=remote` with `APP_REMOTE_URL` pointing at your
      Netlify deploy → the desktop app loads the deployed site instead of the
      bundled build.

## 10. Deploy (web)

- [ ] Push to GitHub, import to Netlify (picks up `netlify.toml`), set the two
      env vars, deploy.
- [ ] Deep-link/refresh on a route like `/tickets` on the deployed site → no
      404 (the SPA redirect handles it).

## Ticket workspace regression checks

From the project root, run `npm ci`, `npm run lint` and `npm run build`. To check relative asset paths for Electron, run `BUILD_TARGET=desktop npm run build` in a POSIX shell.

The PostgreSQL tests run on Linux with Python 3, a non-root user, and a free local TCP port. In a Python virtual environment run:

```sh
python -m pip install pgserver psycopg2-binary
python tests/workspace_database.py
python tests/audit_database.py
python tests/staff_notes_database.py
```

The script creates and stops a disposable PostgreSQL cluster. It provides the Supabase auth-role fixtures, runs migrations in order, seeds two staff members and verifies competing claims on separate connections. It also checks employee scope, audit entries, page bounds, literal search, reply timestamps and role demotion. The bundled PostgreSQL uses its built-in UUID generator.

The additional suites verify access to ticket, role and deletion history, and the privacy, retry and concurrency behavior of internal notes.

For a deployment smoke test, apply outstanding migrations through 0011 to staging first. Sign in as two agents, claim the same open ticket, reply, then switch between All, Unassigned and Assigned to me. Open the same ticket from an employee account and verify its assignee and replies. Repeat on a narrow screen and with reduced motion enabled.

### Browser smoke test

Install the dev dependencies with `npm ci`. With a Python virtual environment active, run:

```sh
python -m pip install playwright
python -m playwright install chromium
python tests/workspace_browser.py
```

The test builds a separate web bundle in a temporary directory, serves the assets inside Chromium and intercepts the Supabase requests with local fixtures. It exercises sign-up navigation, both queue layouts, pagination, search, claiming, replying, a confirmed status change, staff navigation, dark mode and reduced motion. To use an existing Chromium installation, set `CHROMIUM_PATH` to its executable.
