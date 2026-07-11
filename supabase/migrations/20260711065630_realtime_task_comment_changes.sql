do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
end;
$$;

create function private.is_workspace_topic_member(target_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
begin
  if target_topic is null or target_topic !~ '^workspace:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  target_workspace_id := split_part(target_topic, ':', 2)::uuid;

  return (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members
      where workspace_id = target_workspace_id
        and user_id = (select auth.uid())
    );
exception
  when invalid_text_representation then
    return false;
end;
$$;

revoke all on function private.is_workspace_topic_member(text) from public;
grant execute on function private.is_workspace_topic_member(text) to authenticated;

create policy "Workspace members can receive delete broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and private.is_workspace_topic_member((select realtime.topic()))
);

create function private.broadcast_workspace_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
    and not exists (
      select 1
      from public.workspace_members
      where workspace_id = old.workspace_id
        and user_id = (select auth.uid())
    ) then
    raise insufficient_privilege using message = 'workspace access denied';
  end if;

  perform realtime.send(
    jsonb_build_object('table', tg_table_name, 'id', old.id),
    'DELETE',
    'workspace:' || old.workspace_id::text,
    true
  );

  return old;
end;
$$;

revoke all on function private.broadcast_workspace_delete() from public;

create trigger broadcast_task_deleted
after delete on public.tasks
for each row execute function private.broadcast_workspace_delete();

create trigger broadcast_comment_deleted
after delete on public.comments
for each row execute function private.broadcast_workspace_delete();
