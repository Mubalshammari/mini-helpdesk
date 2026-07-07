-- =============================================================================
-- Mini Helpdesk — Migration 0003: notifications
-- =============================================================================
-- Run this ONCE, after 0001_init.sql and 0002_role_tiers.sql. Adds a
-- notifications table pushed to clients live via Supabase Realtime, so
-- staff see new tickets and everyone sees new replies without refreshing.
--
-- WHY A TABLE, NOT JUST "SUBSCRIBE TO TICKETS/COMMENTS DIRECTLY"
--
-- The simplest version of this feature would have the client subscribe to
-- Realtime postgres_changes on `tickets` and `ticket_comments` directly and
-- decide client-side whether a given insert is "for" the current user. That
-- puts a security decision in the client's hands - exactly what this whole
-- project has avoided everywhere else. A dedicated `notifications` table
-- keeps the same rule this project uses throughout: the server (a trigger,
-- here) decides who's allowed to know about something, not the client. Each
-- row is already scoped to exactly one recipient, so RLS on this table is a
-- single, simple predicate (`recipient_id = auth.uid()`) instead of the
-- client having to reason about ticket ownership/staff status itself for
-- every event it receives.
--
-- WHY REALTIME + RLS IS SAFE HERE
--
-- Supabase's Realtime `postgres_changes` stream re-checks every change
-- against the subscribing client's own RLS SELECT policy before delivering
-- it - a client only ever receives realtime rows it could already query
-- directly. Since notifications_select_own (below) already restricts
-- SELECT to `recipient_id = auth.uid()`, enabling replication on this table
-- introduces no new exposure: "can this client see this row over realtime"
-- reduces to the exact same question as "can this client see this row via
-- a normal select," which was already answered.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.notifications') is not null then
    raise exception 'Migration 0003 already applied (public.notifications already exists).';
  end if;
end $$;


-- =============================================================================
-- 1. TABLE
-- =============================================================================
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  ticket_id    uuid references public.tickets (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  type         text not null check (type in ('new_ticket', 'new_comment')),
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

revoke all on public.notifications from anon, authenticated;
alter table public.notifications enable row level security;

create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index notifications_recipient_unread_idx on public.notifications (recipient_id) where not read;


-- =============================================================================
-- 2. RLS AND GRANTS
-- =============================================================================
-- Re-checks CURRENT ticket visibility, not just "was this addressed to me" -
-- the same pattern comments_select_if_ticket_visible uses (0001_init.sql
-- section 7). Without the second clause, a notification row would stay
-- readable forever based only on who it was addressed to at insert time:
-- promote someone to 'it', a ticket comes in and they're notified, later
-- demote them back to 'employee' - tickets_select_own_or_staff correctly
-- cuts off their access to the ticket itself, but nothing would touch the
-- notification row, leaving them able to read its ticket_id/actor_id/
-- created_at indefinitely for a ticket they can no longer otherwise query.
-- Re-deriving visibility live, the same way every other reference to a
-- ticket in this schema already does, closes that instead of needing a
-- cleanup trigger to chase every place a role change could strand a row.
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (
    recipient_id = auth.uid()
    and (
      ticket_id is null
      or exists (
        select 1 from public.tickets t
        where t.id = notifications.ticket_id
          and (t.user_id = auth.uid() or public.is_staff())
      )
    )
  );

-- The only thing a client may ever change about a notification is its own
-- read flag - not who it's for, not what it's about, not whether it
-- existed. Same column-level-grant pattern as profiles.full_name in
-- 0001_init.sql: an UPDATE statement that references any column besides
-- `read` is rejected before RLS even runs.
create policy "notifications_update_own_read_status"
  on public.notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

grant select on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;
-- No INSERT/DELETE grant to any client role - only the SECURITY DEFINER
-- triggers below create rows, and nothing ever deletes one. "Was this
-- person notified" shouldn't be something a client can forge or erase any
-- more than the audit log should be.

-- Realtime: without this, notification rows would only ever be seen on the
-- next manual refetch, not pushed live. See the file header for why this is
-- safe to enable given the RLS policy above.
alter publication supabase_realtime add table public.notifications;


-- =============================================================================
-- 3. new_ticket — notify every staff member when someone files a ticket
-- =============================================================================
-- Excludes the ticket's own creator: an admin or IT filing their own ticket
-- (create_ticket() doesn't restrict who can create one) shouldn't notify
-- themselves about their own submission.
create or replace function public.notify_new_ticket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, ticket_id, actor_id, type)
  select p.id, new.id, new.user_id, 'new_ticket'
  from public.profiles p
  where p.role in ('it', 'admin')
    and p.id <> new.user_id;

  return new;
end;
$$;

drop trigger if exists trg_notify_new_ticket on public.tickets;
create trigger trg_notify_new_ticket
  after insert on public.tickets
  for each row execute function public.notify_new_ticket();


-- =============================================================================
-- 4. new_comment — notify the ticket owner and every staff member
-- =============================================================================
-- Recipients are "the ticket owner" UNION "every staff member," minus
-- whoever just posted the comment. UNION (not UNION ALL) already dedupes,
-- so a staff member who owns the ticket they're replying on doesn't appear
-- twice - though they're excluded anyway since they're the actor.
create or replace function public.notify_new_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket_owner uuid;
begin
  select user_id into v_ticket_owner from public.tickets where id = new.ticket_id;

  insert into public.notifications (recipient_id, ticket_id, actor_id, type)
  select recipients.recipient, new.ticket_id, new.user_id, 'new_comment'
  from (
    select v_ticket_owner as recipient
    union
    select p.id as recipient from public.profiles p where p.role in ('it', 'admin')
  ) recipients
  where recipients.recipient <> new.user_id;

  return new;
end;
$$;

drop trigger if exists trg_notify_new_comment on public.ticket_comments;
create trigger trg_notify_new_comment
  after insert on public.ticket_comments
  for each row execute function public.notify_new_comment();

commit;
