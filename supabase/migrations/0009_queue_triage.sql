begin;

create index tickets_priority_activity_idx on public.tickets(priority desc, updated_at desc, id);

-- The five-argument entry point below stays available to older desktop clients.
-- The new client sends all seven arguments, so PostgREST can select the signature by name.
create function public.ticket_queue(
  p_search text,
  p_status public.ticket_status,
  p_category public.ticket_category,
  p_scope text,
  p_page integer,
  p_priority public.ticket_priority,
  p_sort text
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with matching as not materialized (
    select t.id, t.title, t.status, t.priority, t.category, t.created_at, t.updated_at,
           t.assigned_to, requester.full_name as requester
    from public.tickets t
    join public.profiles requester on requester.id = t.user_id
    where (p_status is null or t.status = p_status)
      and (p_category is null or t.category = p_category)
      and (p_priority is null or t.priority = p_priority)
      and (
        p_scope = 'all'
        or (p_scope = 'mine' and t.assigned_to = (select auth.uid()))
        or (p_scope = 'unassigned' and t.assigned_to is null and t.status in ('open','in_progress'))
        or (p_scope = 'urgent' and t.priority = 'urgent' and t.status in ('open','in_progress'))
      )
      and (
        p_search = '' or strpos(lower(t.title), lower(p_search)) > 0
        or strpos(lower(t.description), lower(p_search)) > 0
        or strpos(lower(requester.full_name), lower(p_search)) > 0
      )
  ), page_info as (
    select count(*) as total,
           least(greatest(p_page, 1), greatest(1, ceil(count(*) / 20.0)::int)) as page
    from matching
  )
  select jsonb_build_object(
    'total', total,
    'page', page,
    'rows', array(
      select to_jsonb(m) || jsonb_build_object('assignee', agent.full_name)
      from matching m
      left join public.profiles agent on agent.id = m.assigned_to
      order by
        case when p_sort = 'priority' then m.priority end desc,
        case when p_sort = 'oldest' then m.status in ('open','in_progress') end desc,
        case when p_sort = 'oldest' then m.created_at end asc,
        m.updated_at desc, m.id
      limit 20 offset (select (page - 1)::bigint * 20 from page_info)
    )
  ) from page_info;
$$;

revoke all on function public.ticket_queue(text,public.ticket_status,public.ticket_category,text,int,public.ticket_priority,text)
  from public, anon;
grant execute on function public.ticket_queue(text,public.ticket_status,public.ticket_category,text,int,public.ticket_priority,text)
  to authenticated;

create or replace function public.ticket_queue(
  p_search text default '', p_status public.ticket_status default null,
  p_category public.ticket_category default null, p_scope text default 'all',
  p_page integer default 1
) returns jsonb language sql stable security invoker set search_path = '' as $$
  select public.ticket_queue(p_search, p_status, p_category, p_scope, p_page, null, 'recent');
$$;

commit;
