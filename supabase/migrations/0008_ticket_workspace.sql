begin;

alter table public.tickets add column assigned_to uuid
  references public.profiles(id) on delete set null;
create index tickets_assignee_updated_idx on public.tickets (assigned_to, updated_at desc, id);
create index tickets_updated_idx on public.tickets (updated_at desc, id);

-- Assignment is an atomic operation. Ordinary edits still use the existing update trigger.
revoke update on public.tickets from authenticated;
grant update (title, description, priority, status) on public.tickets to authenticated;

create function public.claim_ticket(p_ticket uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  holder uuid;
begin
  if not exists (select 1 from public.profiles where id = caller and role in ('it','admin') for share) then
    raise exception 'Only support staff can claim tickets.' using errcode = '42501';
  end if;
  update public.tickets set assigned_to = caller
  where id = p_ticket and assigned_to is null and status in ('open','in_progress')
  returning assigned_to into holder;
  if found then return holder; end if;
  select assigned_to into holder from public.tickets where id = p_ticket;
  if holder is null then raise exception 'This ticket is no longer available to claim.'; end if;
  return holder;
end $$;

-- Return a demoted agent's work to the queue. Deleting an agent uses the FK above.
create function public.release_agent_tickets() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.tickets set assigned_to = null where assigned_to = new.id;
  return new;
end $$;
create trigger release_agent_tickets after update of role on public.profiles
for each row when (old.role <> new.role and new.role = 'employee')
execute function public.release_agent_tickets();

create function public.ticket_queue(
  p_search text default '', p_status public.ticket_status default null,
  p_category public.ticket_category default null, p_scope text default 'all',
  p_page integer default 1
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with matching as not materialized (
    select t.id, t.updated_at
    from public.tickets t join public.profiles requester on requester.id = t.user_id
    where (p_status is null or t.status = p_status)
      and (p_category is null or t.category = p_category)
      and (p_scope = 'all'
        or (p_scope = 'mine' and t.assigned_to = (select auth.uid()))
        or (p_scope = 'unassigned' and t.assigned_to is null and t.status in ('open','in_progress')))
      and (p_search = '' or strpos(lower(t.title), lower(p_search)) > 0
        or strpos(lower(t.description), lower(p_search)) > 0
        or strpos(lower(requester.full_name), lower(p_search)) > 0)
  ), totals as (
    select count(*) as total, least(greatest(p_page, 1), greatest(1, ceil(count(*) / 20.0)::int)) as page
    from matching
  ), page_ids as (
    select id from matching order by updated_at desc, id limit 20 offset (select (page - 1)::bigint * 20 from totals)
  ), rows as (
    select t.id, t.title, t.status, t.priority, t.category, t.updated_at,
      t.assigned_to, requester.full_name as requester, agent.full_name as assignee
    from page_ids join public.tickets t using (id)
    join public.profiles requester on requester.id = t.user_id
    left join public.profiles agent on agent.id = t.assigned_to
  )
  select jsonb_build_object('total', total, 'page', page, 'rows',
    coalesce((select jsonb_agg(to_jsonb(r) order by updated_at desc, id) from rows r), '[]'::jsonb)) from totals;
$$;

-- Replies count as activity even when a ticket's status stays the same.
create function public.touch_commented_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.tickets set updated_at = now() where id = new.ticket_id;
  return new;
end $$;
create trigger refresh_ticket_activity after insert on public.ticket_comments
for each row execute function public.touch_commented_ticket();
revoke all on function public.touch_commented_ticket() from public, anon, authenticated;

create function public.ticket_overview(p_day_start timestamptz, p_day_end timestamptz)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'open', count(*) filter (where status = 'open'),
    'in_progress', count(*) filter (where status = 'in_progress'),
    'resolved', count(*) filter (where status = 'resolved'),
    'closed', count(*) filter (where status = 'closed'),
    'today', count(*) filter (where created_at >= p_day_start and created_at < p_day_end),
    'unassigned', count(*) filter (where assigned_to is null and status in ('open','in_progress')),
    'recent', coalesce((select jsonb_agg(to_jsonb(r) order by updated_at desc, id)
      from (select id, title, status, priority, updated_at from public.tickets order by updated_at desc, id limit 5) r), '[]'::jsonb)
  ) from public.tickets;
$$;

revoke all on function public.release_agent_tickets() from public, anon, authenticated;
revoke all on function public.claim_ticket(uuid), public.ticket_queue(text,public.ticket_status,public.ticket_category,text,int),
  public.ticket_overview(timestamptz,timestamptz) from public, anon;
grant execute on function public.claim_ticket(uuid), public.ticket_queue(text,public.ticket_status,public.ticket_category,text,int),
  public.ticket_overview(timestamptz,timestamptz) to authenticated;
commit;
