-- =============================================================================
-- Mini Helpdesk — Migration 0002: three role tiers
-- =============================================================================
-- Run this ONCE, after 0001_init.sql, on a project that already has the
-- original two-tier ('user'/'admin') schema applied. This is an ALTER
-- migration against a live database with real rows in it, not a fresh
-- create — it renames existing role values in place rather than dropping
-- and recreating anything.
--
-- WHAT'S CHANGING AND WHY
--
-- The original design had one staff tier: 'admin' could see every ticket,
-- change status/priority, and read the audit log. Splitting that into two
-- tiers - 'it' (ticket handling, same capabilities the old 'admin' had) and
-- 'admin' (everything 'it' can do, plus the ability to change *other*
-- users' roles) - means role management itself needs a real, narrow,
-- audited path through the app for the first time. Every table/table in
-- 0001_init.sql was built around "role changes are impossible from the
-- client, full stop." That guarantee doesn't disappear here — it narrows to
-- "role changes are impossible from the client, except through one
-- SECURITY DEFINER function that independently re-verifies the caller is
-- an admin, and an independent trigger that checks the same thing a second
-- time regardless of what that function did." Two people checking the same
-- ID at the door instead of one, not a security downgrade.
--
-- This whole file runs as ONE transaction (begin/commit at top/bottom).
-- Every statement here is ordinary transactional DDL/DML - no CONCURRENTLY,
-- nothing that requires running outside a transaction block - so wrapping
-- it costs nothing and closes two real gaps a statement-by-statement runner
-- would otherwise leave open: (1) a signup landing in the middle of this
-- script, between the constraint/data changes and the handle_new_user()
-- repoint, could get inserted with a role value from the wrong scheme; (2)
-- if a later statement fails (e.g. on unexpected data), everything before
-- it would already be durably committed, leaving the database in a
-- half-migrated state that's hard to diagnose and unsafe to just re-run.
-- Wrapped in one transaction, either all of this applies or none of it does.
-- =============================================================================

begin;

-- Guards against accidentally re-running this migration a second time.
-- Without this, re-running the data migration below would match ANY row
-- that currently has role = 'admin' - including someone legitimately
-- promoted to the new top admin tier after the first run - and silently
-- demote them back to 'it'. role_history is created fresh by this
-- migration and can't exist before it's run once, so its presence is a
-- reliable signal this migration already applied.
do $$
begin
  if to_regclass('public.role_history') is not null then
    raise exception 'Migration 0002 already applied (public.role_history already exists) - aborting to avoid re-running the data migration and reclassifying any admin promoted since the first run.';
  end if;
end $$;


-- =============================================================================
-- 1. MIGRATE ROLE VALUES AND THE CHECK CONSTRAINT
-- =============================================================================
-- Drop the old constraint before touching the data - the new one (added at
-- the end of this block) wouldn't accept the old values, so this order
-- matters: drop, migrate data, add new constraint.
alter table public.profiles drop constraint if exists profiles_role_check;

-- The old 'admin' meant "handles tickets," which is what 'it' means now.
-- The old 'user' meant "submits tickets," which is what 'employee' means
-- now. Nobody ends up in the new top 'admin' tier automatically - that's
-- provisioned the same deliberate, manual way the very first admin was
-- (see the bottom of 0001_init.sql, still accurate for this tier too).
update public.profiles set role = 'it' where role = 'admin';
update public.profiles set role = 'employee' where role = 'user';

alter table public.profiles alter column role set default 'employee';
alter table public.profiles add constraint profiles_role_check check (role in ('employee', 'it', 'admin'));


-- =============================================================================
-- 2. SIGNUP PROVISIONING — new users land as 'employee', not 'user'
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'employee');
  return new;
end;
$$;


-- =============================================================================
-- 3. is_admin() NARROWS, is_staff() TAKES OVER ITS OLD JOB
-- =============================================================================
-- is_admin() used to mean "can this caller handle tickets" (the old
-- single staff tier). It now means exactly what its name says - strictly
-- the top 'admin' tier - because migration 4 below gives it a new,
-- higher-stakes job: authorizing role changes. Every place in 0001_init.sql
-- that called is_admin() for ticket-related access (RLS policies, the
-- ticket-update trigger, the audit log policy) is repointed at the new
-- is_staff() below, which preserves the exact old behavior (it OR admin,
-- matching what 'admin' alone used to grant).
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

create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('it', 'admin')
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;


-- =============================================================================
-- 4. REPOINT TICKET-RELATED POLICIES/TRIGGERS AT is_staff()
-- =============================================================================
drop policy if exists "tickets_select_own_or_admin" on public.tickets;
create policy "tickets_select_own_or_staff"
  on public.tickets for select
  to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "tickets_update_admin" on public.tickets;
create policy "tickets_update_staff"
  on public.tickets for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create or replace function public.enforce_ticket_update_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_staff boolean := public.is_staff();
  v_is_owner boolean := old.user_id = auth.uid();
  v_title_or_description_changed boolean :=
    new.title is distinct from old.title or new.description is distinct from old.description;
  v_status_or_priority_changed boolean :=
    new.status is distinct from old.status or new.priority is distinct from old.priority;
begin
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

  if v_status_or_priority_changed and not v_is_staff then
    raise exception 'Only IT staff may change ticket status or priority.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop policy if exists "comments_select_if_ticket_visible" on public.ticket_comments;
create policy "comments_select_if_ticket_visible"
  on public.ticket_comments for select
  to authenticated
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_comments.ticket_id
        and (t.user_id = auth.uid() or public.is_staff())
    )
  );

drop policy if exists "comments_insert_own_visible" on public.ticket_comments;
create policy "comments_insert_own_visible"
  on public.ticket_comments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_comments.ticket_id
        and (t.user_id = auth.uid() or public.is_staff())
    )
  );

drop policy if exists "history_select_admin_only" on public.ticket_history;
create policy "history_select_staff_only"
  on public.ticket_history for select
  to authenticated
  using (public.is_staff());


-- =============================================================================
-- 5. set_user_role() — the one path a role can ever change through the app
-- =============================================================================
-- Same shape as create_ticket() in 0001_init.sql: SECURITY DEFINER because
-- the column-level grant on profiles.role still only allows full_name for
-- `authenticated` (unchanged, see section 6 of 0001_init.sql) - this
-- function runs with elevated privileges to perform the write, but
-- authorizes the action itself, explicitly, before it ever touches the
-- table. It doesn't relax the "impossible from the client" guarantee; it's
-- the one deliberate, narrow, audited hole in it, for exactly one tier.
create table if not exists public.role_history (
  id         uuid primary key default gen_random_uuid(),
  target_id  uuid references public.profiles (id) on delete set null,
  actor_id   uuid references public.profiles (id) on delete set null,
  old_role   text not null,
  new_role   text not null,
  created_at timestamptz not null default now()
);

revoke all on public.role_history from anon, authenticated;
alter table public.role_history enable row level security;

create policy "role_history_select_admin_only"
  on public.role_history for select
  to authenticated
  using (public.is_admin());

grant select on public.role_history to authenticated;
-- No INSERT/UPDATE/DELETE grant to anyone - only set_user_role() writes
-- here, same immutable-log pattern as ticket_history.

create or replace function public.set_user_role(p_target_user_id uuid, p_new_role text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles;
  v_old_role text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can change user roles.';
  end if;

  if p_target_user_id = auth.uid() then
    raise exception 'You cannot change your own role.';
  end if;

  if p_new_role not in ('employee', 'it', 'admin') then
    raise exception 'Invalid role.';
  end if;

  -- FOR UPDATE locks the target row before reading it, closing a TOCTOU gap
  -- between two concurrent set_user_role() calls on the SAME target user:
  -- without a lock, both could read the same pre-update role, both pass
  -- their checks, and both write - Postgres serializes the actual UPDATEs,
  -- but the second one would still log role_history using the *stale* role
  -- it read before waiting, producing a non-chaining audit trail (e.g. two
  -- entries that both claim to start from 'employee' when the second one
  -- actually started from whatever the first admin just committed). The
  -- lock forces the second caller to wait for the first to commit, then
  -- re-read the now-current row - the row-level equivalent of the
  -- pg_advisory_xact_lock create_ticket() takes in 0001_init.sql for a
  -- different shape of the same class of race.
  select * into v_target from public.profiles where id = p_target_user_id for update;

  if v_target.id is null then
    raise exception 'User not found.';
  end if;

  if v_target.role = p_new_role then
    return v_target;
  end if;

  v_old_role := v_target.role;

  update public.profiles
  set role = p_new_role
  where id = p_target_user_id
  returning * into v_target;

  insert into public.role_history (target_id, actor_id, old_role, new_role)
  values (p_target_user_id, auth.uid(), v_old_role, p_new_role);

  return v_target;
end;
$$;

grant execute on function public.set_user_role(uuid, text) to authenticated;

-- The trigger below is what actually enforces this at the table level - the
-- is_admin() check inside set_user_role() above is the first gate, but the
-- trigger is a second, fully independent one. It doesn't trust that the
-- call came from set_user_role() (there's no session flag or "trust me"
-- signal to forge) - it re-derives "is auth.uid() an admin, right now"
-- itself, from profiles.role. If set_user_role() had a bug in its own
-- check, this still holds the line. This runs on EVERY update to profiles
-- regardless of which code path triggered it, exactly as in 0001_init.sql -
-- only the condition for "who's allowed" changed, from "nobody, ever
-- through the API" to "nobody through the API, except a caller whose own
-- profiles.role is already 'admin.'"
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
    and auth.role() = 'authenticated'
    and not public.is_admin()
  then
    raise exception 'Changing role is not permitted through the application.';
  end if;
  return new;
end;
$$;

commit;
