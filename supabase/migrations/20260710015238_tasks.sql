create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo',
  priority text not null default 'medium',
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_id_workspace_unique unique (id, workspace_id),
  constraint tasks_title_length
    check (char_length(btrim(title)) between 1 and 200),
  constraint tasks_title_trimmed
    check (title = btrim(title)),
  constraint tasks_description_length
    check (description is null or char_length(description) <= 5000),
  constraint tasks_status_valid
    check (status in ('todo', 'in_progress', 'done')),
  constraint tasks_priority_valid
    check (priority in ('low', 'medium', 'high'))
);

create index tasks_workspace_updated_idx
  on public.tasks (workspace_id, updated_at desc, id desc);

create index tasks_workspace_status_updated_idx
  on public.tasks (workspace_id, status, updated_at desc, id desc);

create index tasks_workspace_assignee_updated_idx
  on public.tasks (workspace_id, assignee_id, updated_at desc, id desc);

create index tasks_created_by_idx
  on public.tasks (created_by);

create index tasks_assignee_id_idx
  on public.tasks (assignee_id);

revoke all on table public.tasks from anon, authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.tasks to service_role;

alter table public.tasks enable row level security;

create function private.set_task_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_task_updated_at() from public;

create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function private.set_task_updated_at();

create function private.enforce_task_invariants()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.id is distinct from new.id then
      raise exception 'task id cannot be changed'
        using errcode = 'P0001';
    end if;

    if old.workspace_id is distinct from new.workspace_id then
      raise exception 'task workspace cannot be changed'
        using errcode = 'P0001';
    end if;

    if old.created_by is distinct from new.created_by then
      raise exception 'task creator cannot be changed'
        using errcode = 'P0001';
    end if;
  end if;

  if new.assignee_id is not null and not exists (
    select 1
    from public.workspace_members
    where workspace_id = new.workspace_id
      and user_id = new.assignee_id
  ) then
    raise exception 'task assignee must belong to the workspace'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_task_invariants() from public;

create trigger enforce_task_invariants
before insert or update on public.tasks
for each row execute function private.enforce_task_invariants();

create policy "Workspace members can read tasks"
on public.tasks
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Workspace members can create tasks"
on public.tasks
for insert
to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

create policy "Workspace members can update tasks"
on public.tasks
for update
to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));

create policy "Workspace members can delete tasks"
on public.tasks
for delete
to authenticated
using (private.is_workspace_member(workspace_id));

create view public.workspace_task_stats
with (security_invoker = true)
as
select
  workspace_id,
  count(*)::bigint as total,
  count(*) filter (where status = 'todo')::bigint as todo,
  count(*) filter (where status = 'in_progress')::bigint as in_progress,
  count(*) filter (where status = 'done')::bigint as done
from public.tasks
group by workspace_id;

revoke all on table public.workspace_task_stats from anon, authenticated;
grant select on table public.workspace_task_stats to authenticated;
grant select on table public.workspace_task_stats to service_role;

create function public.get_workspace_stats(target_workspace_id uuid)
returns table (
  total bigint,
  todo bigint,
  in_progress bigint,
  done bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = (select auth.uid())
  ) then
    raise insufficient_privilege using message = 'workspace access denied';
  end if;

  return query
  select
    count(*)::bigint,
    count(*) filter (where tasks.status = 'todo')::bigint,
    count(*) filter (where tasks.status = 'in_progress')::bigint,
    count(*) filter (where tasks.status = 'done')::bigint
  from public.tasks
  where tasks.workspace_id = target_workspace_id;
end;
$$;

revoke all on function public.get_workspace_stats(uuid) from public;
grant execute on function public.get_workspace_stats(uuid) to authenticated;
