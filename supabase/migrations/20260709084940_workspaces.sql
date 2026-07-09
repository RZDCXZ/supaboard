create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_name_length
    check (char_length(btrim(name)) between 1 and 100),
  constraint workspaces_name_trimmed
    check (name = btrim(name))
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  added_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  constraint workspace_members_role_valid
    check (role in ('owner', 'member'))
);

create unique index workspace_members_one_owner_per_workspace
  on public.workspace_members (workspace_id)
  where role = 'owner';

create index workspaces_owner_id_idx
  on public.workspaces (owner_id);

create index workspace_members_user_workspace_idx
  on public.workspace_members (user_id, workspace_id);

create index workspace_members_workspace_role_idx
  on public.workspace_members (workspace_id, role);

revoke all on table public.workspaces from anon, authenticated;
revoke all on table public.workspace_members from anon, authenticated;

grant select, insert, update, delete on table public.workspaces to authenticated;
grant select, insert, update, delete on table public.workspace_members to authenticated;
grant select, insert, update, delete on table public.workspaces to service_role;
grant select, insert, update, delete on table public.workspace_members to service_role;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members
      where workspace_id = target_workspace_id
        and user_id = (select auth.uid())
    );
$$;

create function private.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members
      where workspace_id = target_workspace_id
        and user_id = (select auth.uid())
        and role = 'owner'
    );
$$;

revoke all on function private.is_workspace_member(uuid) from public;
revoke all on function private.is_workspace_owner(uuid) from public;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.is_workspace_owner(uuid) to authenticated;

create function private.set_workspace_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_workspace_updated_at() from public;

create trigger set_workspaces_updated_at
before update on public.workspaces
for each row execute function private.set_workspace_updated_at();

create function private.prevent_workspace_owner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.owner_id is distinct from new.owner_id then
    raise exception 'workspace owner cannot be changed'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_workspace_owner_change() from public;

create trigger prevent_workspaces_owner_change
before update on public.workspaces
for each row execute function private.prevent_workspace_owner_change();

create function private.mark_workspace_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('private.deleting_workspace_id', old.id::text, true);
  return old;
end;
$$;

revoke all on function private.mark_workspace_delete() from public;

create trigger mark_workspaces_delete
before delete on public.workspaces
for each row execute function private.mark_workspace_delete();

create function private.ensure_workspace_owner_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.workspace_members
    where workspace_id = new.id
      and user_id = new.owner_id
      and role = 'owner'
  ) then
    raise exception 'workspace must have a matching owner member'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

revoke all on function private.ensure_workspace_owner_member() from public;

create constraint trigger ensure_workspaces_owner_member
after insert or update of owner_id on public.workspaces
deferrable initially deferred
for each row execute function private.ensure_workspace_owner_member();

create function private.protect_workspace_member_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.workspace_id is distinct from new.workspace_id
      or old.user_id is distinct from new.user_id then
      raise exception 'workspace member identity cannot be changed'
        using errcode = 'P0001';
    end if;

    if old.role = 'owner' then
      raise exception 'workspace owner membership cannot be changed'
        using errcode = 'P0001';
    end if;

    if new.role = 'owner' then
      raise exception 'workspace owner membership must be created by workspace creation'
        using errcode = 'P0001';
    end if;

    return new;
  end if;

  if old.role = 'owner'
    and current_setting('private.deleting_workspace_id', true) is distinct from old.workspace_id::text then
    raise exception 'workspace owner membership cannot be deleted'
      using errcode = 'P0001';
  end if;

  return old;
end;
$$;

revoke all on function private.protect_workspace_member_owner() from public;

create trigger protect_workspace_member_owner
before update or delete on public.workspace_members
for each row execute function private.protect_workspace_member_owner();

create policy "Workspace members can read workspaces"
on public.workspaces
for select
to authenticated
using (private.is_workspace_member(id));

create policy "Users can insert owned workspaces"
on public.workspaces
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy "Workspace owners can update workspaces"
on public.workspaces
for update
to authenticated
using (private.is_workspace_owner(id))
with check (private.is_workspace_owner(id));

create policy "Workspace owners can delete workspaces"
on public.workspaces
for delete
to authenticated
using (private.is_workspace_owner(id));

create policy "Workspace members can read members"
on public.workspace_members
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Owners can insert workspace members"
on public.workspace_members
for insert
to authenticated
with check (
  (
    role = 'owner'
    and user_id = (select auth.uid())
  )
  or (
    role = 'member'
    and private.is_workspace_owner(workspace_id)
  )
);

create policy "Owners can update workspace members"
on public.workspace_members
for update
to authenticated
using (private.is_workspace_owner(workspace_id))
with check (
  role = 'member'
  and private.is_workspace_owner(workspace_id)
);

create policy "Owners can delete workspace members"
on public.workspace_members
for delete
to authenticated
using (private.is_workspace_owner(workspace_id));

create function public.create_workspace(name text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid;
  workspace_name text;
  new_workspace_id uuid;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null then
    raise exception 'not authenticated'
      using errcode = 'P0001';
  end if;

  workspace_name := btrim(name);

  if char_length(workspace_name) not between 1 and 100 then
    raise exception 'workspace name must be between 1 and 100 characters'
      using errcode = 'P0001';
  end if;

  new_workspace_id := gen_random_uuid();

  insert into public.workspaces (id, name, owner_id)
  values (new_workspace_id, workspace_name, current_user_id);

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'owner');

  return new_workspace_id;
end;
$$;

revoke all on function public.create_workspace(text) from public;
grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.create_workspace(text) to service_role;
