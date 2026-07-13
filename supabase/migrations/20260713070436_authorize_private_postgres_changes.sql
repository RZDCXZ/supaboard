create function private.is_workspace_postgres_topic_member(target_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
begin
  if target_topic is null or target_topic !~ '^workspace-postgres:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
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

revoke all on function private.is_workspace_postgres_topic_member(text) from public;
grant execute on function private.is_workspace_postgres_topic_member(text) to authenticated;

create policy "Workspace members can subscribe to postgres changes"
on realtime.messages
for select
to authenticated
using (
  private.is_workspace_postgres_topic_member((select realtime.topic()))
);
