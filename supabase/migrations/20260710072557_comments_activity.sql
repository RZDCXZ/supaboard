create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  workspace_id uuid not null,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_task_workspace_fkey
    foreign key (task_id, workspace_id)
    references public.tasks(id, workspace_id)
    on delete cascade,
  constraint comments_body_length
    check (char_length(btrim(body)) between 1 and 2000),
  constraint comments_body_trimmed
    check (body = btrim(body))
);

create index comments_task_created_idx
  on public.comments (task_id, created_at, id);

create index comments_workspace_id_idx
  on public.comments (workspace_id);

create index comments_author_id_idx
  on public.comments (author_id);

revoke all on table public.comments from anon, authenticated;
grant select, insert, update, delete on table public.comments to authenticated;
grant select, insert, update, delete on table public.comments to service_role;

alter table public.comments enable row level security;

create function private.set_comment_updated_at()
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

revoke all on function private.set_comment_updated_at() from public;

create trigger set_comments_updated_at
before update on public.comments
for each row execute function private.set_comment_updated_at();

create function private.enforce_comment_invariants()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.id is distinct from new.id then
    raise exception 'comment id cannot be changed'
      using errcode = 'P0001';
  end if;

  if old.task_id is distinct from new.task_id then
    raise exception 'comment task cannot be changed'
      using errcode = 'P0001';
  end if;

  if old.workspace_id is distinct from new.workspace_id then
    raise exception 'comment workspace cannot be changed'
      using errcode = 'P0001';
  end if;

  if old.author_id is distinct from new.author_id then
    raise exception 'comment author cannot be changed'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_comment_invariants() from public;

create trigger enforce_comment_invariants
before update on public.comments
for each row execute function private.enforce_comment_invariants();

create policy "Workspace members can read comments"
on public.comments
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Workspace members can create comments"
on public.comments
for insert
to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and author_id = (select auth.uid())
);

create policy "Authors can update comments"
on public.comments
for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and author_id = (select auth.uid())
)
with check (
  private.is_workspace_member(workspace_id)
  and author_id = (select auth.uid())
);

create policy "Authors and owners can delete comments"
on public.comments
for delete
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and (
    author_id = (select auth.uid())
    or private.is_workspace_owner(workspace_id)
  )
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null default 'task',
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_logs_action_valid
    check (action in ('task.created', 'task.status_changed', 'task.deleted')),
  constraint activity_logs_entity_type_valid
    check (entity_type = 'task'),
  constraint activity_logs_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index activity_logs_workspace_created_idx
  on public.activity_logs (workspace_id, created_at desc, id desc);

create index activity_logs_actor_id_idx
  on public.activity_logs (actor_id);

revoke all on table public.activity_logs from anon, authenticated, service_role;
revoke all on sequence public.activity_logs_id_seq from anon, authenticated, service_role;
grant select on table public.activity_logs to authenticated;
grant select on table public.activity_logs to service_role;

alter table public.activity_logs enable row level security;

create policy "Workspace members can read activity logs"
on public.activity_logs
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create function private.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
begin
  target_workspace_id := case when tg_op = 'DELETE' then old.workspace_id else new.workspace_id end;

  if (select auth.uid()) is not null
    and not private.is_workspace_member(target_workspace_id) then
    raise insufficient_privilege using message = 'workspace access denied';
  end if;

  if tg_op = 'INSERT' then
    insert into public.activity_logs (
      workspace_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      new.workspace_id,
      (select auth.uid()),
      'task.created',
      'task',
      new.id,
      jsonb_build_object('title', new.title)
    );

    return new;
  end if;

  if tg_op = 'UPDATE' then
    insert into public.activity_logs (
      workspace_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      new.workspace_id,
      (select auth.uid()),
      'task.status_changed',
      'task',
      new.id,
      jsonb_build_object(
        'title', new.title,
        'from_status', old.status,
        'to_status', new.status
      )
    );

    return new;
  end if;

  insert into public.activity_logs (
    workspace_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    old.workspace_id,
    (select auth.uid()),
    'task.deleted',
    'task',
    old.id,
    jsonb_build_object('title', old.title, 'status', old.status)
  );

  return old;
end;
$$;

revoke all on function private.log_task_activity() from public;

create trigger log_task_created_activity
after insert on public.tasks
for each row execute function private.log_task_activity();

create trigger log_task_status_changed_activity
after update of status on public.tasks
for each row
when (old.status is distinct from new.status)
execute function private.log_task_activity();

create trigger log_task_deleted_activity
after delete on public.tasks
for each row execute function private.log_task_activity();
