create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  workspace_id uuid not null,
  uploader_id uuid not null references public.profiles(id) on delete restrict,
  bucket_id text not null default 'attachments',
  object_path text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now(),
  constraint attachments_task_workspace_fkey
    foreign key (task_id, workspace_id)
    references public.tasks(id, workspace_id)
    on delete cascade,
  constraint attachments_bucket_fixed
    check (bucket_id = 'attachments'),
  constraint attachments_object_path_matches_task
    check (
      cardinality(string_to_array(object_path, '/')) = 3
      and split_part(object_path, '/', 1) = workspace_id::text
      and split_part(object_path, '/', 2) = task_id::text
      and split_part(object_path, '/', 3) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[A-Za-z0-9][A-Za-z0-9._-]{0,119}$'
    ),
  constraint attachments_file_name_valid
    check (
      file_name = btrim(file_name)
      and char_length(file_name) between 1 and 255
      and file_name !~ '[\\/[:cntrl:]]'
    ),
  constraint attachments_content_type_valid
    check (
      content_type in (
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'text/plain'
      )
    ),
  constraint attachments_size_valid
    check (size_bytes between 1 and 10485760)
);

create index attachments_task_created_idx
  on public.attachments (task_id, created_at, id);

create index attachments_workspace_idx
  on public.attachments (workspace_id);

create index attachments_uploader_idx
  on public.attachments (uploader_id);

revoke all on table public.attachments from anon, authenticated;
grant select, insert, delete on table public.attachments to authenticated;
grant select, insert, update, delete on table public.attachments to service_role;

alter table public.attachments enable row level security;

create policy "Workspace members can read attachments"
on public.attachments
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy "Workspace members can create attachments"
on public.attachments
for insert
to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and uploader_id = (select auth.uid())
);

create policy "Uploaders or owners can delete attachments"
on public.attachments
for delete
to authenticated
using (
  uploader_id = (select auth.uid())
  or private.is_workspace_owner(workspace_id)
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'attachments',
  'attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/plain'
  ]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function private.is_task_attachment_member(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and cardinality(storage.foldername(object_name)) = 2
    and exists (
      select 1
      from public.workspace_members as member
      join public.tasks as task
        on task.workspace_id = member.workspace_id
      where member.user_id = (select auth.uid())
        and member.workspace_id::text = (storage.foldername(object_name))[1]
        and task.id::text = (storage.foldername(object_name))[2]
    );
$$;

create function private.is_task_attachment_owner(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and cardinality(storage.foldername(object_name)) = 2
    and exists (
      select 1
      from public.workspace_members as member
      join public.tasks as task
        on task.workspace_id = member.workspace_id
      where member.user_id = (select auth.uid())
        and member.role = 'owner'
        and member.workspace_id::text = (storage.foldername(object_name))[1]
        and task.id::text = (storage.foldername(object_name))[2]
    );
$$;

revoke all on function private.is_task_attachment_member(text) from public;
revoke all on function private.is_task_attachment_owner(text) from public;
grant execute on function private.is_task_attachment_member(text) to authenticated;
grant execute on function private.is_task_attachment_owner(text) to authenticated;

create policy "Task attachment members can select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'attachments'
  and private.is_task_attachment_member(name)
);

create policy "Task attachment members can insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'attachments'
  and private.is_task_attachment_member(name)
  and owner_id = (select auth.uid())::text
);

create policy "Task attachment uploaders or owners can delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'attachments'
  and (
    owner_id = (select auth.uid())::text
    or private.is_task_attachment_owner(name)
  )
);
