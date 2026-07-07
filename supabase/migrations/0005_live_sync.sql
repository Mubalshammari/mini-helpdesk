-- =============================================================================
-- Mini Helpdesk — Migration 0005: live sync (Realtime on tickets + comments)
-- =============================================================================
-- Run this ONCE, after 0001-0004. Adds tickets and ticket_comments to the
-- supabase_realtime publication so changes push to open clients live -
-- until now only notifications was published (0003).
--
-- WHY THIS IS SAFE - the same argument 0003 made for notifications:
-- Supabase Realtime's postgres_changes stream re-checks every change
-- against the subscribing client's own RLS SELECT policy before delivering
-- it. A client only ever receives realtime events for rows it could
-- already query directly:
--   - tickets: an employee only receives events for their own tickets
--     (tickets_select_own_or_staff); staff receive events for all.
--   - ticket_comments: delivery follows comments_select_if_ticket_visible,
--     including its EXISTS subquery against tickets - only participants
--     and staff receive a comment's event.
-- Publishing a table changes WHEN a client learns about a row (push vs
-- next fetch), never WHICH rows it's allowed to see.
--
-- The client deliberately doesn't read event payloads to patch its UI -
-- any event just triggers the same refetch path the manual Refresh button
-- uses. One code path for "get current data" (manual refresh, realtime
-- nudge, reconnect catch-up) means one code path to get right.
--
-- ONE IMPORTANT ASYMMETRY - why DELETE events are dropped below:
-- Supabase Realtime re-checks RLS against the subscriber's SELECT policy
-- for INSERT and UPDATE, but it CANNOT for DELETE - the row is already
-- gone, so there's nothing to evaluate the policy against, and the WAL
-- delete record carries only the primary key. So a published DELETE is
-- broadcast to every subscriber regardless of RLS, leaking the row's uuid
-- (plus timing/volume) even to users who could never have SELECTed it.
-- The only DELETEs that ever happen on these tables are the cascade from
-- an admin deleting a user account (0006) - there is no other delete path.
-- Rather than leak the uuids of an offboarded user's tickets/comments to
-- every connected employee, this migration restricts the whole
-- supabase_realtime publication to insert+update only. The functional cost
-- is nil: the client only uses events as a refetch nudge, and after an
-- account deletion the next manual refresh (or any other event) reconciles
-- the removed rows anyway. Nothing in this app needs live DELETE events.
-- =============================================================================

begin;

-- Restrict the publication to insert+update+truncate (dropping delete) so
-- cascade-delete uuids from account deletion never broadcast unfiltered.
-- This is a publication-wide setting; it also covers notifications (0003),
-- whose deletes are likewise cascade-only and not needed live.
alter publication supabase_realtime set (publish = 'insert,update,truncate');

-- ALTER PUBLICATION ... ADD TABLE errors on a table that's already in the
-- publication, so both adds are guarded to make this file safely
-- re-runnable, matching the re-run guards in 0002-0004.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tickets'
  ) then
    alter publication supabase_realtime add table public.tickets;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ticket_comments'
  ) then
    alter publication supabase_realtime add table public.ticket_comments;
  end if;
end $$;

commit;
