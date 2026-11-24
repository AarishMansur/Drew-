do $$
begin
  create type public.space_role as enum ('owner', 'editor', 'viewer');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.space_members (
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.space_role not null,
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create table if not exists public.space_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  email text,
  role public.space_role not null,
  created_by uuid not null references auth.users (id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint space_invites_role check (role in ('editor', 'viewer'))
);

alter table public.shapes
  add column if not exists updated_at timestamptz not null default now();

insert into public.space_members (space_id, user_id, role)
select id, owner_id, 'owner'::public.space_role
from public.spaces
where owner_id is not null
on conflict do nothing;

create or replace function public.set_shapes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shapes_set_updated_at on public.shapes;
create trigger shapes_set_updated_at
before update on public.shapes
for each row execute function public.set_shapes_updated_at();

create or replace function public.add_space_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.space_members (space_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists spaces_add_owner on public.spaces;
create trigger spaces_add_owner
after insert on public.spaces
for each row execute function public.add_space_owner();

create or replace function public.is_space_member(
  target uuid,
  roles public.space_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.space_members m
    where m.space_id = target
      and m.user_id = auth.uid()
      and (roles is null or m.role = any (roles))
  );
$$;

create or replace function public.accept_space_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.space_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to accept this invite';
  end if;

  select * into invite
  from public.space_invites
  where token = invite_token
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;
  if invite.accepted_at is not null then
    raise exception 'Invite already used';
  end if;
  if invite.expires_at < now() then
    raise exception 'Invite expired';
  end if;
  if invite.email is not null
     and lower(invite.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'This invite is for a different email';
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (invite.space_id, auth.uid(), invite.role)
  on conflict (space_id, user_id) do nothing;

  update public.space_invites
  set accepted_at = now(), accepted_by = auth.uid()
  where id = invite.id;

  return invite.space_id;
end;
$$;

revoke all on function public.is_space_member(uuid, public.space_role[]) from public;
revoke all on function public.accept_space_invite(uuid) from public;
grant execute on function public.is_space_member(uuid, public.space_role[]) to authenticated;
grant execute on function public.accept_space_invite(uuid) to authenticated;
grant usage on type public.space_role to authenticated;

alter table public.spaces enable row level security;
alter table public.shapes enable row level security;
alter table public.space_members enable row level security;
alter table public.space_invites enable row level security;

do $$
declare
  old_policy record;
begin
  for old_policy in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('spaces', 'shapes')
      and policyname not like 'drew_%'
  loop
    execute format('drop policy if exists %I on public.%I', old_policy.policyname, old_policy.tablename);
  end loop;
end $$;

drop policy if exists drew_spaces_select on public.spaces;
create policy drew_spaces_select on public.spaces
for select using (owner_id = auth.uid() or public.is_space_member(id));

drop policy if exists drew_spaces_insert on public.spaces;
create policy drew_spaces_insert on public.spaces
for insert with check (owner_id = auth.uid());

drop policy if exists drew_spaces_update on public.spaces;
create policy drew_spaces_update on public.spaces
for update using (public.is_space_member(id, array['owner']::public.space_role[]));

drop policy if exists drew_spaces_delete on public.spaces;
create policy drew_spaces_delete on public.spaces
for delete using (public.is_space_member(id, array['owner']::public.space_role[]));

drop policy if exists drew_members_select on public.space_members;
create policy drew_members_select on public.space_members
for select using (user_id = auth.uid() or public.is_space_member(space_id));

drop policy if exists drew_members_insert_owner on public.space_members;
create policy drew_members_insert_owner on public.space_members
for insert with check (
  user_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1 from public.spaces s
    where s.id = space_id and s.owner_id = auth.uid()
  )
);

drop policy if exists drew_shapes_select on public.shapes;
create policy drew_shapes_select on public.shapes
for select using (public.is_space_member(space_id));

drop policy if exists drew_shapes_insert on public.shapes;
create policy drew_shapes_insert on public.shapes
for insert with check (
  public.is_space_member(space_id, array['owner', 'editor']::public.space_role[])
);

drop policy if exists drew_shapes_update on public.shapes;
create policy drew_shapes_update on public.shapes
for update using (
  public.is_space_member(space_id, array['owner', 'editor']::public.space_role[])
);

drop policy if exists drew_shapes_delete on public.shapes;
create policy drew_shapes_delete on public.shapes
for delete using (
  public.is_space_member(space_id, array['owner', 'editor']::public.space_role[])
);

drop policy if exists drew_invites_select on public.space_invites;
create policy drew_invites_select on public.space_invites
for select using (
  public.is_space_member(space_id, array['owner']::public.space_role[])
  or (
    email is not null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists drew_invites_insert on public.space_invites;
create policy drew_invites_insert on public.space_invites
for insert with check (
  created_by = auth.uid()
  and role in ('editor', 'viewer')
  and public.is_space_member(space_id, array['owner']::public.space_role[])
);

grant select, insert, update, delete on public.spaces to authenticated;
grant select, insert, update, delete on public.shapes to authenticated;
grant select, insert on public.space_members to authenticated;
grant select, insert on public.space_invites to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shapes'
  ) then
    alter publication supabase_realtime add table public.shapes;
  end if;
end $$;
