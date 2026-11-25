create table if not exists public.keepalive (
  id int primary key,
  pinged_at timestamptz not null default now(),
  constraint keepalive_one_row check (id = 1)
);

insert into public.keepalive (id)
values (1)
on conflict (id) do nothing;

alter table public.keepalive enable row level security;

drop policy if exists keepalive_select on public.keepalive;
create policy keepalive_select on public.keepalive
for select to anon, authenticated
using (true);

create or replace function public.keepalive_ping()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  update public.keepalive
  set pinged_at = now()
  where id = 1
  returning pinged_at;
$$;

revoke all on function public.keepalive_ping() from public;
grant execute on function public.keepalive_ping() to anon, authenticated;
