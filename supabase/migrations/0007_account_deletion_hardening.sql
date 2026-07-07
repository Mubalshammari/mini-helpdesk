-- =============================================================================
-- Mini Helpdesk — Migration 0007: account-deletion hardening (forward-fix)
-- =============================================================================
-- Run this ONCE, after 0006. It upgrades an already-applied 0006 to the
-- hardened version of that migration, WITHOUT re-running 0006 (whose
-- re-run guard aborts once account_deletions exists - which is exactly
-- the error that sends you here). Everything below is idempotent, so it
-- is a harmless no-op on a database that already has the hardened 0006 -
-- you can run it either way.
--
-- WHY A NEW FILE INSTEAD OF EDITING 0006: a migration that's already been
-- applied to a live database is history - you fix it forward with the next
-- migration, you don't rewrite the one that already ran. This file is that
-- forward fix.
--
-- WHAT IT CHANGES (relative to the original 0006):
--  1. delete_user_account() gains an ADMIN-TARGET GUARD - you can no longer
--     delete an admin directly (demote them first). Closes the "one admin
--     deletes every other admin and becomes sole controller + sole reader
--     of the deletion log" vector.
--  2. account_deletions gains actor_full_name, snapshotted at deletion time,
--     so "deleted by <name>" stays readable even after the deleting admin is
--     themselves later deleted (a plain actor_id FK would SET NULL and lose
--     it).
--  3. EXECUTE on the RPC is revoked from public/anon - the most destructive
--     function in the system isn't reachable without an authenticated
--     session, matching the two-layer rule the tables already follow.
--  4. Indexes on the FK columns the delete cascade scans, so deleting a
--     long-tenured user doesn't seq-scan notifications per ticket and blow
--     past the ~8s statement timeout.
--  5. The Realtime publication is restricted to insert/update/truncate, so
--     cascade-delete row uuids never broadcast unfiltered (Realtime can't
--     apply RLS to DELETE events). Idempotent; also covers you if you ran
--     an earlier 0005 without this line.
-- =============================================================================

begin;

-- 1. Missing audit column (no-op if the hardened 0006 already added it).
alter table public.account_deletions
  add column if not exists actor_full_name text not null default '';

-- 2. Cascade-performance indexes.
create index if not exists notifications_ticket_id_idx on public.notifications (ticket_id);
create index if not exists notifications_actor_id_idx on public.notifications (actor_id);
create index if not exists ticket_history_actor_id_idx on public.ticket_history (actor_id);

-- 3. Realtime: drop DELETE events from the publication (safe to re-run).
alter publication supabase_realtime set (publish = 'insert,update,truncate');

-- 4. Replace the function with the hardened body (admin guard + actor
--    snapshot). CREATE OR REPLACE keeps the same signature, so it just
--    swaps the body - no drop, no dependency churn.
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

  select * into v_target from public.profiles where id = p_target_user_id for update;

  if v_target.id is null then
    raise exception 'User not found.';
  end if;

  if v_target.role = 'admin' then
    raise exception 'Admins cannot be deleted. Change their role to employee or IT first, then delete.';
  end if;

  select full_name into v_actor_name from public.profiles where id = auth.uid();

  insert into public.account_deletions
    (deleted_user_id, deleted_full_name, deleted_role, actor_id, actor_full_name)
  values
    (v_target.id, v_target.full_name, v_target.role, auth.uid(), coalesce(v_actor_name, ''));

  delete from auth.users where id = p_target_user_id;
end;
$$;

-- 5. Grant-layer defense in depth (idempotent).
revoke execute on function public.delete_user_account(uuid) from public, anon;
grant execute on function public.delete_user_account(uuid) to authenticated;

commit;
