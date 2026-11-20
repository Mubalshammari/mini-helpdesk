begin;

create index ticket_history_activity_idx on public.ticket_history (created_at desc, id);
create index role_history_activity_idx on public.role_history (created_at desc, id);
create index deletion_activity_idx on public.account_deletions (created_at desc, id);

-- Each branch reads with the caller's privileges. Only admins can see the two account logs.
create function public.audit_activity(
  p_search text default '',
  p_kind text default 'all',
  p_since timestamptz default null,
  p_page integer default 1
) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with events as not materialized (
    select h.id, h.created_at, 'ticket'::text as kind, h.action, h.ticket_id,
      t.title as subject, coalesce(nullif(actor.full_name, ''), 'Former user') as actor,
      case when h.action = 'assigned_to_changed' then
          case when h.old_value #>> '{}' is null then 'Unassigned' else coalesce(nullif(previous.full_name, ''), 'Former agent') end
        else h.old_value #>> '{}' end as before,
      case when h.action = 'assigned_to_changed' then
          case when h.new_value #>> '{}' is null then 'Unassigned' else coalesce(nullif(current_agent.full_name, ''), 'Former agent') end
        else h.new_value #>> '{}' end as after
    from public.ticket_history h join public.tickets t on t.id = h.ticket_id
    left join public.profiles actor on actor.id = h.actor_id
    left join public.profiles previous on previous.id =
      case when h.action = 'assigned_to_changed' then (h.old_value #>> '{}')::uuid end
    left join public.profiles current_agent on current_agent.id =
      case when h.action = 'assigned_to_changed' then (h.new_value #>> '{}')::uuid end

    union all
    select r.id, r.created_at, 'access', 'role_changed', null::uuid,
      coalesce(nullif(target.full_name, ''), 'Former team member'),
      coalesce(nullif(actor.full_name, ''), 'Former administrator'), r.old_role, r.new_role
    from public.role_history r
    left join public.profiles target on target.id = r.target_id
    left join public.profiles actor on actor.id = r.actor_id

    union all
    select d.id, d.created_at, 'account', 'account_deleted', null::uuid,
      coalesce(nullif(d.deleted_full_name, ''), 'Former team member'),
      coalesce(nullif(d.actor_full_name, ''), nullif(actor.full_name, ''), 'Former administrator'),
      d.deleted_role, null::text
    from public.account_deletions d left join public.profiles actor on actor.id = d.actor_id
  ), matches as not materialized (
    select * from events
    where (p_kind = 'all' or kind = p_kind)
      and (p_since is null or created_at >= p_since)
      and (p_search = '' or strpos(lower(concat_ws(' ', subject, actor, replace(action, '_', ' '),
        case when action = 'assigned_to_changed' then 'assignment' end, before, after)), lower(p_search)) > 0)
  ), bounds as (
    select count(*) as total,
      least(greatest(1, p_page), greatest(1, ceil(count(*) / 25.0)::int)) as page
    from matches
  ), items as (
    select * from matches order by created_at desc, kind, id
    limit 25 offset (select (page - 1)::bigint * 25 from bounds)
  )
  select jsonb_build_object('total', total, 'page', page, 'rows',
    coalesce((select jsonb_agg(to_jsonb(i) order by created_at desc, kind, id) from items i), '[]'::jsonb))
  from bounds;
$$;

revoke all on function public.audit_activity(text,text,timestamptz,integer) from public, anon;
grant execute on function public.audit_activity(text,text,timestamptz,integer) to authenticated;
commit;
