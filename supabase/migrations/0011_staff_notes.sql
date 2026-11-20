begin;

create table public.ticket_staff_notes (
  id uuid primary key,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index ticket_staff_notes_thread_idx
  on public.ticket_staff_notes(ticket_id, created_at desc, id desc);
create index ticket_staff_notes_author_idx
  on public.ticket_staff_notes(author_id, created_at);

alter table public.ticket_staff_notes enable row level security;
revoke all on public.ticket_staff_notes from public, anon, authenticated;
grant select on public.ticket_staff_notes to authenticated;

create policy staff_can_read_ticket_notes on public.ticket_staff_notes
  for select to authenticated using ((select public.is_staff()));

-- A private note leaves the public ticket timestamp, notification feed and reply count untouched.
create function public.add_staff_note(p_ticket uuid, p_note uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  note_body text := btrim(p_body, E' \t\r\n');
  recent_count integer;
begin
  -- Serialize this author's retries and rate-limit check, including concurrent demotion.
  perform id from public.profiles
  where id = caller and role in ('it','admin') for update;
  if not found then
    raise exception 'Only support staff can add internal notes.' using errcode = '42501';
  end if;
  if p_note is null or note_body is null or char_length(note_body) not between 1 and 2000 then
    raise exception 'Write a note between 1 and 2,000 characters.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.ticket_staff_notes where id = p_note and ticket_id = p_ticket
      and author_id = caller and body = note_body
  ) then
    return p_note;
  end if;

  select count(*) into recent_count from public.ticket_staff_notes
    where author_id = caller and created_at > now() - interval '1 hour';
  if recent_count >= 20 then
    raise exception 'You can add up to 20 internal notes per hour. Please try again later.';
  end if;
  insert into public.ticket_staff_notes(id, ticket_id, author_id, body)
    values (p_note, p_ticket, caller, note_body);
  return p_note;
end;
$$;

revoke all on function public.add_staff_note(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.add_staff_note(uuid,uuid,text) to authenticated;

commit;
