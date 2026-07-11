alter policy "Workspace members can receive delete broadcasts"
on realtime.messages
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and private.is_workspace_topic_member((select realtime.topic()))
);

create policy "Workspace members can send workspace realtime"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and private.is_workspace_topic_member((select realtime.topic()))
);
