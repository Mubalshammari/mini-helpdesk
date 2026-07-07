-- =============================================================================
-- Mini Helpdesk — Migration 0006: admin-initiated account deletion
-- =============================================================================
-- Run this ONCE, after 0001-0005. Gives admins a real offboarding path from
-- inside the app: delete_user_account() permanently removes a user.
--
-- WHY AN RPC AND NOT THE SUPABASE ADMIN API: deleting an auth user
-- normally requires the service_role key, which must never ship in a
-- client. A SECURITY DEFINER function owned by the postgres role is the
-- one safe client-reachable path - it can touch auth.users, but only
-- after ITS OWN authorization checks pass, exactly the same pattern as
-- create_ticket() and set_user_role().
--
-- WHAT DELETING auth.users CASCADES TO (all defined in earlier migrations):
--   auth.users -> profiles (CASCADE, 0001)
--     profiles -> tickets they filed (CASCADE) -> those tickets' comments,
--       history rows, and notifications (CASCADE)
--     profiles -> comments they wrote on ANYONE's ticket (CASCADE)
--     profiles -> notifications addressed to them (CASCADE)
--   actor_id references (ticket_history, role_history, notifications,
--     account_deletions) are ON DELETE SET NULL, so those audit rows
--     SURVIVE the actor, only losing the actor's uuid.
--
-- HONEST STATEMENT OF WHAT IS DESTROYED, NOT JUST WHAT SURVIVES: this is a
-- genuinely permanent, cascading delete. The deleted user's tickets are
-- gone, and with them their ENTIRE history rows - INCLUDING rows where a
-- DIFFERENT staff member was the actor (those rows die via the ticket_id
-- cascade, not the actor_id SET NULL). So permanent deletion trades away
-- some audit history: it is NOT true that "every record of what anyone did
-- to this user's tickets survives." What survives independently is the
-- account_deletions row below (who deleted whom, when) plus history/role
-- rows attached to OTHER users' still-existing tickets. This is the
-- accepted cost of a hard delete; a soft-delete/disable-login model would
-- preserve everything but isn't what "delete permanently" means.
--
-- The worst version of that trade - an admin quietly erasing records of
-- their own misconduct by deleting whole cohorts of admins/oversight - is
-- closed by the admin-target guard in the function: you cannot delete an
-- admin at all through this path. Demote them first (set_user_role), which
-- is itself audited in role_history, THEN delete. Two audited steps, no
-- silent admin purge.
--
-- KNOWN LIMIT: a deleted user's already-issued JWT stays valid until it
-- expires (~1 hour). Their session/refresh-token rows cascade away with
-- auth.users so it can never refresh, and every RLS check that depends on
-- their (now-gone) profiles row fails during that window - they're locked
-- out of everything that matters, just not force-logged-out to the second.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.account_deletions') is not null then
    raise exception 'Migration 0006 already applied (public.account_deletions already exists).';
  end if;
end $$;


-- =============================================================================
-- 1. Performance: index the FKs the deletion cascade scans
-- =============================================================================
-- Every ticket the deleted user filed forces an FK-enforcement scan of
-- notifications for rows referencing that ticket_id, and the SET NULL passes
-- scan by actor_id - both columns were unindexed (0003 only indexed
-- recipient_id). Without these, deleting a long-tenured user can seq-scan
-- notifications once per ticket and blow past the authenticated role's ~8s
-- statement timeout, making the account undeletable through the app. These
-- indexes turn those scans into index lookups.
create index if not exists notifications_ticket_id_idx on public.notifications (ticket_id);
create index if not exists notifications_actor_id_idx on public.notifications (actor_id);
create index if not exists ticket_history_actor_id_idx on public.ticket_history (actor_id);


-- =============================================================================
-- 2. account_deletions — immutable record of who deleted whose account
-- =============================================================================
-- deleted_user_id is a raw uuid, deliberately NOT a foreign key: the profile
-- row this points at is destroyed in the same transaction that writes this
-- row, so an FK could never hold. Name and role are snapshotted for the same
-- reason. actor_id is also snapshotted as a name (actor_full_name), not left
-- to a plain FK: when the deleting admin is themselves later deleted, an
-- actor_id FK would SET NULL and the record would lose all trace of who did
-- the deletion - the snapshot keeps "deleted by <name>" readable forever,
-- consistent with how the deleted side is already snapshotted.
create table public.account_deletions (
  id                uuid primary key default gen_random_uuid(),
  deleted_user_id   uuid not null,
  deleted_full_name text not null default '',
  deleted_role      text not null default '',
  actor_id          uuid references public.profiles (id) on delete set null,
  actor_full_name   text not null default '',
  created_at        timestamptz not null default now()
);

revoke all on public.account_deletions from anon, authenticated;
alter table public.account_deletions enable row level security;

create policy "account_deletions_select_admin_only"
  on public.account_deletions for select
  to authenticated
  using (public.is_admin());

grant select on public.account_deletions to authenticated;
-- No INSERT/UPDATE/DELETE grant to any client role - only the function
-- below writes here, same immutable-log pattern as every other audit table.


-- =============================================================================
-- 3. delete_user_account() — the only client-reachable deletion path
-- =============================================================================
create or replace function public.delete_user_account(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles;
  v_actor_name text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can delete accounts.';
  end if;

  if p_target_user_id = auth.uid() then
    raise exception 'You cannot delete your own account.';
  end if;

  -- FOR UPDATE serializes against a concurrent set_user_role() or second
  -- delete on the same target: whoever wins the lock acts on the real
  -- current row; the loser sees the post-commit state (or no row) instead
  -- of a stale snapshot.
  select * into v_target from public.profiles where id = p_target_user_id for update;

  if v_target.id is null then
    raise exception 'User not found.';
  end if;

  -- Admins cannot be deleted directly - this is what stops one admin from
  -- unilaterally deleting every other admin (concentrating both control and
  -- audit-log visibility, since account_deletions is admin-only readable)
  -- and from erasing peer oversight. Deleting an admin is a deliberate
  -- two-step, both audited: demote via set_user_role() (logged to
  -- role_history), then delete.
  if v_target.role = 'admin' then
    raise exception 'Admins cannot be deleted. Change their role to employee or IT first, then delete.';
  end if;

  select full_name into v_actor_name from public.profiles where id = auth.uid();

  -- Audit first, delete second, one transaction: if the delete fails the
  -- audit row rolls back with it - the log can never claim a deletion that
  -- didn't happen, nor a deletion happen without its log row.
  insert into public.account_deletions
    (deleted_user_id, deleted_full_name, deleted_role, actor_id, actor_full_name)
  values
    (v_target.id, v_target.full_name, v_target.role, auth.uid(), coalesce(v_actor_name, ''));

  delete from auth.users where id = p_target_user_id;
end;
$$;

-- Defense in depth, matching the "two independent layers" philosophy 0001
-- applies to every table: Postgres grants EXECUTE on a new function to
-- PUBLIC by default, and Supabase's default privileges additionally grant it
-- straight to anon - so without this revoke, an unauthenticated caller could
-- reach this function's body (the in-body is_admin() check would still
-- reject them, but that's a single layer). Revoking from public and anon
-- means the most destructive RPC in the system isn't even callable without
-- an authenticated session, independent of the in-body check.
revoke execute on function public.delete_user_account(uuid) from public, anon;
grant execute on function public.delete_user_account(uuid) to authenticated;

commit;
