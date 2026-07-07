-- =============================================================================
-- Mini Helpdesk — Migration 0004: creator sets the initial priority
-- =============================================================================
-- Run this ONCE, after 0001-0003. The person filing a ticket knows better
-- than anyone whether their problem is blocking work or a minor annoyance,
-- so create_ticket() now takes a priority instead of always stamping
-- 'medium'. Nothing else about the priority rules changes: after creation,
-- the owner still cannot touch priority (enforce_ticket_update_rules() from
-- 0002 is untouched), and IT staff still re-triage it freely from the queue.
-- Creator sets the starting point; staff own it from there.
--
-- The parameter is typed as public.ticket_priority (the enum), not text -
-- an invalid value is rejected by the type system before the function body
-- even runs, exactly like p_category already is.
-- =============================================================================

begin;

-- CREATE OR REPLACE can only replace a function with the SAME argument
-- list - given a different one, it silently creates an OVERLOAD, leaving
-- both versions callable. That would both keep the old no-priority path
-- alive indefinitely and make PostgREST's RPC dispatch ambiguous (two
-- candidates named create_ticket for a call that omits optional args). So
-- the old 4-argument signature is dropped explicitly first.
drop function if exists public.create_ticket(text, text, public.ticket_category, text);

create or replace function public.create_ticket(
  p_title text,
  p_description text,
  p_category public.ticket_category,
  p_priority public.ticket_priority default 'medium',
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

  -- Honeypot: hidden field no human ever fills; a value here means a bot
  -- submitted the form blind. Same generic error shape as the rate limit
  -- below so a probing bot can't tell which defense caught it.
  if p_honeypot is not null and length(trim(p_honeypot)) > 0 then
    raise exception 'Unable to submit ticket. Please try again later.';
  end if;

  -- Serialize concurrent calls from the same user - see 0001_init.sql 6.2
  -- for the full explanation of the TOCTOU race this closes.
  perform pg_advisory_xact_lock(hashtext('create_ticket'), hashtext(v_user_id::text));

  -- Rate limit: max 5 tickets per rolling hour per user.
  select count(*) into v_recent_count
  from public.tickets
  where user_id = v_user_id
    and created_at > now() - interval '1 hour';

  if v_recent_count >= 5 then
    raise exception 'You have reached the limit of 5 tickets per hour. Please try again later.';
  end if;

  -- Duplicate guard: identical title+description within 10 minutes.
  select count(*) into v_duplicate_count
  from public.tickets
  where user_id = v_user_id
    and title = p_title
    and description = p_description
    and created_at > now() - interval '10 minutes';

  if v_duplicate_count > 0 then
    raise exception 'A similar ticket was already submitted recently.';
  end if;

  insert into public.tickets (user_id, title, description, category, priority)
  values (v_user_id, p_title, p_description, p_category, p_priority)
  returning * into v_new_ticket;

  return v_new_ticket;
end;
$$;

grant execute on function public.create_ticket(text, text, public.ticket_category, public.ticket_priority, text) to authenticated;

commit;
