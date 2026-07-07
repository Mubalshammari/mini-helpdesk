-- =============================================================================
-- Mini Helpdesk — Security Core Migration
-- =============================================================================
-- Run this ONCE in the Supabase SQL Editor (Project → SQL Editor → New query)
-- on a fresh project. It is idempotent-ish (uses IF NOT EXISTS / OR REPLACE
-- where possible) but is designed to run top-to-bottom a single time.
--
-- SECURITY PHILOSOPHY (read this first — it explains almost every choice below)
--
-- 1. Never trust the client. Every rule in this file is enforced by Postgres
--    itself (RLS policies, CHECK constraints, triggers, SECURITY DEFINER
--    functions) — never by application code. The React app is a UI over this,
--    not a gatekeeper.
--
-- 2. Deny by default, grant explicitly. Supabase bootstraps every new project
--    with `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon,
--    authenticated, service_role`, so any table you create is wide open at
--    the SQL-privilege layer the moment it exists — RLS is what's supposed to
--    close it back down. Relying on RLS alone is fragile (one missing policy,
--    or someone reads a table before `ENABLE ROW LEVEL SECURITY` runs, and
--    it's exposed). So every table below gets `REVOKE ALL ... FROM anon,
--    authenticated` immediately after creation, and only the exact
--    privileges actually needed are granted back. RLS then filters *rows*
--    within whatever the grants already allow. Two independent layers have
--    to both fail for a leak to happen.
--
-- 3. `anon` gets nothing, ever. "Auth required for everything" means the
--    anon (unauthenticated) Postgres role has zero privileges on any
--    application table in this file.
--
-- 4. Two DB roles, three app roles. Postgres/PostgREST only distinguishes
--    `anon` vs `authenticated` — there is no separate "admin" Postgres role.
--    Whether a given authenticated user is an admin is an *application-level*
--    fact stored in `profiles.role`, read at query time via `is_admin()`.
--    This is why per-column GRANTs can't distinguish "owner may edit title"
--    from "admin may edit status" — both are the same DB role. That
--    distinction is enforced procedurally, in triggers, instead (see the
--    tickets UPDATE section below).
-- =============================================================================


-- =============================================================================
-- 0. EXTENSIONS
-- =============================================================================
-- gen_random_uuid() ships in Postgres core from v13+, but pgcrypto is what
-- provided it on older versions and Supabase still enables it by default.
-- Requesting it explicitly makes this migration portable regardless of the
-- underlying Postgres version.
create extension if not exists pgcrypto;


-- =============================================================================
-- 1. ENUM TYPES
-- =============================================================================
-- Enums instead of free-text columns: an invalid category/priority/status is
-- rejected at the type level before it ever reaches a CHECK constraint or
-- application logic. Smaller storage, self-documenting, and impossible to
-- typo past.
create type ticket_category as enum ('hardware', 'software', 'network', 'account', 'access', 'other');
create type ticket_priority as enum ('low', 'medium', 'high', 'urgent');
create type ticket_status   as enum ('open', 'in_progress', 'resolved', 'closed');


-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 profiles — one row per auth.users row. Holds the role that everything
--     else in this file keys off. id is NOT a bigserial/uuid-default column:
--     it is set equal to auth.users.id by the signup trigger below, so a
--     profile row and its auth user are always the same identity.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

revoke all on public.profiles from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2.2 tickets
-- -----------------------------------------------------------------------------
create table if not exists public.tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 10 and 2000),
  category    ticket_category not null,
  priority    ticket_priority not null default 'medium',
  status      ticket_status not null default 'open',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

revoke all on public.tickets from anon, authenticated;

create index if not exists tickets_user_id_created_at_idx on public.tickets (user_id, created_at);
create index if not exists tickets_status_idx on public.tickets (status);

-- -----------------------------------------------------------------------------
-- 2.3 ticket_comments
-- -----------------------------------------------------------------------------
create table if not exists public.ticket_comments (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.tickets (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

revoke all on public.ticket_comments from anon, authenticated;

create index if not exists ticket_comments_ticket_id_idx on public.ticket_comments (ticket_id);
create index if not exists ticket_comments_user_id_created_at_idx on public.ticket_comments (user_id, created_at);

-- -----------------------------------------------------------------------------
-- 2.4 ticket_history — immutable audit log. No UPDATE/DELETE policy is ever
--     defined for this table (see section 8), which combined with RLS being
--     enabled and no such policy existing, makes every row permanently
--     write-once. The only INSERT path is the SECURITY DEFINER trigger in
--     section 6.3, which runs as the table owner and bypasses RLS/grants
--     entirely — regular sessions (anon or authenticated) cannot insert,
--     update, or delete a single row, only (if admin) read them.
-- -----------------------------------------------------------------------------
-- actor_id uses ON DELETE SET NULL, deliberately different from every other
-- FK in this file (which cascade). Offboarding an admin (deleting their
-- auth.users row) must never be blocked by, or silently destroy, history
-- rows for actions they took — the audit trail has to survive the actor.
-- ON DELETE CASCADE would let a profile deletion quietly erase audit rows;
-- the default ON DELETE NO ACTION would instead make it impossible to ever
-- delete an admin's account once they've touched a still-open ticket
-- (Postgres rejects the whole cascading delete from auth.users down). SET
-- NULL keeps the row — what happened, when, old/new values — and only
-- loses the specific actor's identity once that identity no longer exists.
create table if not exists public.ticket_history (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.tickets (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  old_value  jsonb,
  new_value  jsonb,
  created_at timestamptz not null default now()
);

revoke all on public.ticket_history from anon, authenticated;

create index if not exists ticket_history_ticket_id_idx on public.ticket_history (ticket_id);


-- =============================================================================
-- 3. is_admin() — the single source of truth for "is the caller an admin?"
-- =============================================================================
-- SECURITY DEFINER + a fixed search_path is what makes this safe to call from
-- inside RLS policies on ANY table, including profiles itself, without
-- recursion or privilege-escalation risk:
--
--  - Why SECURITY DEFINER avoids recursive RLS: if this ran as SECURITY
--    INVOKER (the default), its internal `select ... from profiles` would
--    itself be subject to profiles' RLS policies. If a profiles policy ever
--    called is_admin() (directly or indirectly), Postgres would have to
--    evaluate is_admin() to evaluate the policy that is_admin() is currently
--    being evaluated for — infinite recursion. Running as SECURITY DEFINER
--    executes the function with the privileges of its owner (the migration
--    role, effectively a superuser-equivalent), which bypasses RLS on the
--    table it reads internally, breaking the cycle. The function itself
--    still only ever returns a boolean, so nothing is exposed beyond
--    "yes/no is this caller an admin."
--
--  - Why `set search_path = ''` + fully-qualified names: a SECURITY DEFINER
--    function runs with its owner's privileges, so if its search_path could
--    be influenced by the caller, a malicious caller could create a
--    same-named object earlier in the path and have the function
--    silently operate on the attacker's object instead of the real one
--    (the classic search_path-hijack privilege-escalation pattern, e.g.
--    CVE-2018-1058). Pinning search_path to empty and schema-qualifying
--    every reference (public.profiles, not profiles) closes that off
--    entirely — there is no ambiguous name for an attacker to shadow.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;


-- =============================================================================
-- 4. SIGNUP → PROFILE PROVISIONING
-- =============================================================================
-- Every auth.users row needs a matching profiles row (everything else in this
-- file assumes one exists) with role hard-coded to 'user' — never derived
-- from anything the client sent at signup, so there is no request payload
-- field a new user could set to grant themselves admin on day one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'user');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =============================================================================
-- 5. PROFILES — RLS, grants, and role-change protection
-- =============================================================================
alter table public.profiles enable row level security;

-- SELECT: any authenticated user can read any profile's id/full_name/role.
-- This is a deliberate choice, not an oversight: ticket and comment threads
-- need to display "submitted by <name>" / "reply from <name>" for both
-- regular users and admins, and this is an *internal company* helpdesk where
-- knowing a coworker's name (and that they're on the IT/admin team) isn't
-- sensitive. Nothing more sensitive than full_name/role is ever stored here.
-- (If this were a multi-tenant product, this policy would need to be scoped
-- to "shares a ticket with me" instead of "any authenticated user.")
create policy "profiles_select_any_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- UPDATE: users may update only their own row, and (via the column grant
-- below) only the full_name column. INSERT/DELETE are granted to nobody —
-- rows are created exclusively by handle_new_user() and never deleted by
-- the app.
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
-- Deliberately no INSERT/DELETE grant, and no UPDATE grant on id/role/created_at:
-- an UPDATE statement that even *mentions* those columns in its SET clause is
-- rejected at the grant layer before RLS or the trigger below ever runs.

-- Trigger layer 2 (defense in depth): even if a future migration accidentally
-- widens the UPDATE grant to all columns, this trigger independently blocks
-- any change to `role` that arrives via the API. It distinguishes "via the
-- API" from "via the SQL Editor as the project owner" using auth.role():
-- PostgREST authenticates each request's JWT and executes it as the
-- `authenticated` (or `anon`) Postgres role, which is what auth.role()
-- reports back. A query run directly in the SQL Editor executes as the
-- `postgres` role instead, so auth.role() there returns NULL/'postgres',
-- not 'authenticated' — and the trigger lets it through. This is what makes
-- "grant admin manually via SQL" (see the bottom of this file) work, while
-- making it structurally impossible for ANY client — including an existing
-- admin's own session — to change a role through the app.
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and auth.role() = 'authenticated' then
    raise exception 'Changing role is not permitted through the application.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_change on public.profiles;
create trigger trg_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();


-- =============================================================================
-- 6. TICKETS — RLS, grants, creation RPC, and update rules
-- =============================================================================
alter table public.tickets enable row level security;

-- SELECT: owner or admin.
create policy "tickets_select_own_or_admin"
  on public.tickets for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- UPDATE: two separate policies, exactly as specified. Note what these
-- policies do and don't do — they decide WHO can target a row at all; they
-- deliberately do NOT try to encode "owner can only touch title/description
-- while open" or "admin can only touch status/priority" as WITH CHECK
-- expressions. That's a conscious choice: PostgreSQL combines multiple
-- permissive policies' WITH CHECK clauses with OR, evaluated per policy
-- whose USING clause matched the row. Trying to cram column-level rules into
-- WITH CHECK here would only reliably fire when exactly one policy's USING
-- clause matches (e.g. a plain user editing their own ticket) — a user who
-- is *also* an admin editing their own ticket would match both policies,
-- and OR-combined WITH CHECK clauses would need to independently make sense
-- per-column-band regardless of which policy matched. Column-level diffing
-- needs OLD and NEW simultaneously available, which WITH CHECK doesn't give
-- you — a BEFORE UPDATE trigger does. So: RLS = row access, trigger (6.1
-- below) = column-level rules, checked per column-band (title/description
-- vs status/priority) rather than per caller-type — see that trigger's own
-- comment for why that distinction matters for an owner who is also an
-- admin. That trigger runs unconditionally on every UPDATE regardless of
-- which policy let the row through, so there's no gap between the layers.
create policy "tickets_update_owner"
  on public.tickets for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "tickets_update_admin"
  on public.tickets for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- INSERT: deliberately NO policy, and INSERT is not in the grant below.
-- Row creation needs to count the caller's recent tickets and check for
-- duplicates before the row exists — logic a declarative WITH CHECK can't
-- express cleanly. create_ticket() (6.2) is the only path in; direct
-- `insert into tickets` is rejected at the grant layer regardless of RLS.
--
-- DELETE: no policy, no grant. Nothing may ever delete a ticket — "closing"
-- is a status update (status = 'closed'), not a delete.
grant select on public.tickets to authenticated;
grant update on public.tickets to authenticated; -- column-level split isn't possible; see note above, enforced by trigger 6.1 instead
-- No INSERT, no DELETE granted here.

-- -----------------------------------------------------------------------------
-- 6.1 BEFORE UPDATE trigger — the actual column-level enforcement described
--     above. Also folds in "auto-update updated_at" so there's a single
--     place that runs on every tickets UPDATE.
--
--     This checks each column *band* against the capacity it requires,
--     rather than branching once on "is this caller an admin?" for the
--     whole statement. That distinction matters for a user who is both a
--     ticket's owner AND an admin (plausible: an admin can file their own
--     ticket via create_ticket() like anyone else). A single admin/not-admin
--     branch would force that user into the admin-only branch unconditionally
--     and permanently block them from editing their own open ticket's
--     title/description — stricter than intended, since as the *owner* they
--     should still get that right. Checking bands independently means each
--     band is authorized by whichever capacity actually applies to it: title/
--     description needs ownership (+ status='open'), status/priority needs
--     is_admin() — a caller who has both capacities satisfies both bands
--     independently instead of being forced into a single bucket.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_ticket_update_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean := public.is_admin();
  v_is_owner boolean := old.user_id = auth.uid();
  v_title_or_description_changed boolean :=
    new.title is distinct from old.title or new.description is distinct from old.description;
  v_status_or_priority_changed boolean :=
    new.status is distinct from old.status or new.priority is distinct from old.priority;
begin
  -- category and user_id are frozen for everyone, no exceptions.
  if new.category is distinct from old.category or new.user_id is distinct from old.user_id then
    raise exception 'Ticket category and owner cannot be changed.';
  end if;

  if v_title_or_description_changed then
    if not v_is_owner then
      raise exception 'Only the ticket owner may edit its title or description.';
    end if;
    if old.status <> 'open' then
      raise exception 'This ticket can no longer be edited because it is not open.';
    end if;
  end if;

  if v_status_or_priority_changed and not v_is_admin then
    raise exception 'Only an admin may change ticket status or priority.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enforce_ticket_update_rules on public.tickets;
create trigger trg_enforce_ticket_update_rules
  before update on public.tickets
  for each row execute function public.enforce_ticket_update_rules();

-- -----------------------------------------------------------------------------
-- 6.2 create_ticket() — the only way to create a ticket. Wraps the insert in
--     the rate limit and duplicate-guard business rules from the spec.
--     SECURITY DEFINER because direct INSERT on tickets is revoked above;
--     this function performs the insert as its owner, but authorizes it
--     itself via auth.uid() — it does not skip authorization, it relocates
--     it from "declarative RLS" to "procedural plpgsql" because the rules
--     (row counts, cross-row duplicate comparison) need procedural logic.
-- -----------------------------------------------------------------------------
create or replace function public.create_ticket(
  p_title text,
  p_description text,
  p_category public.ticket_category,
  p_honeypot text default ''
)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_recent_count int;
  v_duplicate_count int;
  v_new_ticket public.tickets;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  -- Honeypot: this field is hidden via CSS and never filled by a human.
  -- Any non-empty value here means an automated client submitted it blind.
  -- The error message is deliberately generic and identical in shape to the
  -- rate-limit error below, so a bot probing the API can't distinguish
  -- "caught by honeypot" from "rate limited" and tune itself around it.
  if p_honeypot is not null and length(trim(p_honeypot)) > 0 then
    raise exception 'Unable to submit ticket. Please try again later.';
  end if;

  -- Serialize concurrent create_ticket() calls from THIS user. Without this,
  -- the rate-limit and duplicate-guard checks below are a classic TOCTOU
  -- race: two overlapping transactions each run their SELECT count(*) before
  -- either commits its INSERT, both see the same pre-insert count, both pass,
  -- both commit — N parallel requests can blow straight through "max 5/hour"
  -- because nothing before this lock ties the check to the write. An
  -- advisory lock scoped to this transaction (auto-released at commit or
  -- rollback) forces a second concurrent call from the same user to wait
  -- for the first to finish (commit or fail) before it can even run its own
  -- count query — at which point the first call's insert is visible and the
  -- count is accurate. It's namespaced with hashtext('create_ticket') as a
  -- fixed first key so this lock domain can never collide with an unrelated
  -- advisory lock added elsewhere later; hashtext(v_user_id::text) is the
  -- per-user key, so users never block each other, only their own
  -- concurrent requests serialize.
  perform pg_advisory_xact_lock(hashtext('create_ticket'), hashtext(v_user_id::text));

  -- Rate limit: max 5 tickets per rolling hour per user.
  select count(*) into v_recent_count
  from public.tickets
  where user_id = v_user_id
    and created_at > now() - interval '1 hour';

  if v_recent_count >= 5 then
    raise exception 'You have reached the limit of 5 tickets per hour. Please try again later.';
  end if;

  -- Duplicate guard: identical title+description from the same user within
  -- the last 10 minutes is almost certainly a double-submit or a retry loop.
  select count(*) into v_duplicate_count
  from public.tickets
  where user_id = v_user_id
    and title = p_title
    and description = p_description
    and created_at > now() - interval '10 minutes';

  if v_duplicate_count > 0 then
    raise exception 'A similar ticket was already submitted recently.';
  end if;

  -- CHECK constraints on tickets (length bounds) still apply here — this
  -- RPC mirrors them client-side for UX, but this insert is where they're
  -- actually enforced.
  insert into public.tickets (user_id, title, description, category)
  values (v_user_id, p_title, p_description, p_category)
  returning * into v_new_ticket;

  return v_new_ticket;
end;
$$;

grant execute on function public.create_ticket(text, text, public.ticket_category, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 6.3 AFTER UPDATE trigger — immutable audit log. Runs after
--     enforce_ticket_update_rules() has already accepted or rejected the
--     change, so by the time this fires the update is known-valid; it only
--     has to record what changed. One row per changed column, so a single
--     UPDATE that changes both status and priority produces two history
--     rows, each independently attributable.
--
--     Diffs old vs new generically via jsonb instead of a hand-enumerated
--     "if title changed / if status changed / ..." list for each column.
--     A hand-enumerated list is a maintenance trap here specifically: this
--     function and enforce_ticket_update_rules() (6.1) would otherwise be
--     two independent, hand-maintained lists of "columns that can change" —
--     nothing forces them to stay in sync. Relax 6.1 in some future
--     migration to let admins reassign a ticket's category, forget to also
--     touch this function, and that change would silently go unaudited,
--     quietly breaking the "immutable audit log" guarantee for exactly the
--     kind of column most worth auditing. Diffing to_jsonb(old) against
--     to_jsonb(new) key-by-key means any column this table ever gains is
--     covered automatically, with zero action required here. updated_at is
--     the one deliberate exclusion: the BEFORE trigger (6.1) sets it on
--     every single UPDATE, so it would otherwise generate a spurious
--     "updated_at_changed" row alongside every real change.
-- -----------------------------------------------------------------------------
create or replace function public.log_ticket_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_key text;
begin
  for v_key in select jsonb_object_keys(v_new) loop
    if v_key = 'updated_at' then
      continue;
    end if;

    if v_new -> v_key is distinct from v_old -> v_key then
      insert into public.ticket_history (ticket_id, actor_id, action, old_value, new_value)
      values (new.id, auth.uid(), v_key || '_changed', v_old -> v_key, v_new -> v_key);
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_log_ticket_changes on public.tickets;
create trigger trg_log_ticket_changes
  after update on public.tickets
  for each row execute function public.log_ticket_changes();


-- =============================================================================
-- 7. TICKET_COMMENTS — RLS, grants, and rate limiting
-- =============================================================================
alter table public.ticket_comments enable row level security;

-- SELECT: only if the caller can see the parent ticket (owner or admin).
create policy "comments_select_if_ticket_visible"
  on public.ticket_comments for select
  to authenticated
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_comments.ticket_id
        and (t.user_id = auth.uid() or public.is_admin())
    )
  );

-- INSERT: same visibility rule, plus user_id must be the caller's own id
-- (no posting as someone else). Unlike ticket creation, comment creation
-- doesn't need a duplicate guard or a honeypot check that requires
-- procedural logic, so a plain RLS policy is sufficient for ownership and
-- visibility — no RPC needed, which keeps the client code a plain
-- `insert()` call. Rate limiting is deliberately NOT expressed here as a
-- `(select count(*) ...) < 20` clause in WITH CHECK — see 7.1 below for why.
create policy "comments_insert_own_visible"
  on public.ticket_comments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_comments.ticket_id
        and (t.user_id = auth.uid() or public.is_admin())
    )
  );

-- No UPDATE/DELETE policy or grant: comments are immutable once posted.
grant select, insert on public.ticket_comments to authenticated;

-- -----------------------------------------------------------------------------
-- 7.1 BEFORE INSERT trigger — the 20-comments-per-hour rate limit. This is a
--     trigger and not a `(select count(*) ...) < 20` clause in the WITH
--     CHECK above for the same TOCTOU reason create_ticket() needs an
--     advisory lock (6.2): a count-then-compare check has a race window
--     between "read the count" and "commit the row" that concurrent inserts
--     from the same user can slip through. A trigger could in principle
--     still race the same way — the fix here is the same advisory lock
--     pattern, just relocated to where it can run procedurally with
--     guaranteed ordering (lock, then count, then allow). Putting a
--     side-effecting lock call inside a WITH CHECK boolean expression
--     wouldn't reliably fix this: Postgres doesn't guarantee left-to-right
--     evaluation order of AND-ed conditions, so the count subquery could be
--     evaluated before the lock-acquiring one ever runs. A BEFORE trigger
--     gives that ordering guarantee; a boolean expression doesn't.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_comment_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent_count int;
begin
  perform pg_advisory_xact_lock(hashtext('create_comment'), hashtext(new.user_id::text));

  select count(*) into v_recent_count
  from public.ticket_comments
  where user_id = new.user_id
    and created_at > now() - interval '1 hour';

  if v_recent_count >= 20 then
    raise exception 'You have reached the comment limit. Please try again later.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_comment_rate_limit on public.ticket_comments;
create trigger trg_enforce_comment_rate_limit
  before insert on public.ticket_comments
  for each row execute function public.enforce_comment_rate_limit();


-- =============================================================================
-- 8. TICKET_HISTORY — RLS and grants (admin-only, read-only for everyone)
-- =============================================================================
alter table public.ticket_history enable row level security;

create policy "history_select_admin_only"
  on public.ticket_history for select
  to authenticated
  using (public.is_admin());

-- SELECT only. No INSERT/UPDATE/DELETE policy exists for any role, and none
-- is granted below — the only writer is log_ticket_changes() (6.3), which
-- runs SECURITY DEFINER and so bypasses both RLS and this grant entirely.
-- A non-admin querying this table gets zero rows back (RLS-filtered), not a
-- permission error — this table's existence isn't a secret, its contents are.
grant select on public.ticket_history to authenticated;


-- =============================================================================
-- 9. CREATING THE FIRST ADMIN (manual, one-time, project-owner only)
-- =============================================================================
-- There is no signup flag, RPC, or API route anywhere in this system that can
-- grant the 'admin' role — by design (see prevent_role_change() in section 5).
-- The only way to create an admin is:
--
--   1. Have the person sign up normally through the app. This creates their
--      auth.users row and, via handle_new_user(), a profiles row with
--      role = 'user'.
--
--   2. As the project owner, open Supabase Studio → SQL Editor (this
--      connects as the `postgres` role, NOT through PostgREST, so
--      auth.role() is not 'authenticated' and prevent_role_change() does
--      not block the statement) and run:
--
--        update public.profiles set role = 'admin' where id = '<their-auth-user-uuid>';
--
--      Find `<their-auth-user-uuid>` under Authentication → Users, or via:
--
--        select id, email from auth.users where email = 'person@company.com';
--
--   3. Verify: select id, full_name, role from public.profiles where role = 'admin';
--
-- Do this for every admin individually. There is intentionally no bulk or
-- self-service path — that's the point.
-- =============================================================================
