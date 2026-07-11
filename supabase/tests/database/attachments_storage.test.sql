begin;

\ir ./_helpers.psql

select plan(20);

select has_table('public', 'attachments', 'attachments table exists');

select is(
  (select relrowsecurity from pg_class where oid = 'public.attachments'::regclass),
  true,
  'attachments has RLS enabled'
);

select is(
  (select public from storage.buckets where id = 'attachments'),
  false,
  'attachments is a private bucket'
);

select is(
  (select file_size_limit from storage.buckets where id = 'attachments'),
  10485760::bigint,
  'attachments limits files to 10 MB'
);

select results_eq(
  $$select unnest(allowed_mime_types) from storage.buckets where id = 'attachments' order by 1$$,
  $$values
    ('application/pdf'::text),
    ('image/jpeg'::text),
    ('image/png'::text),
    ('image/webp'::text),
    ('text/plain'::text)$$,
  'attachments accepts only documented MIME types'
);

select ok(
  has_table_privilege('authenticated', 'public.attachments', 'select, insert, delete'),
  'authenticated can select, insert, and delete attachment metadata'
);

select is(
  has_table_privilege('authenticated', 'public.attachments', 'update'),
  false,
  'authenticated cannot update attachment metadata'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'attachments'
  ),
  3,
  'attachments has select, insert, and delete policies'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'Task attachment %'
  ),
  3,
  'attachment objects have select, insert, and delete policies'
);

insert into public.tasks (
  id,
  workspace_id,
  title,
  created_by
)
values (
  '00000000-0000-4000-8000-000000000201',
  tests.workspace_id('alpha'),
  'Attachment task',
  tests.user_id('alice')
);

insert into storage.objects (bucket_id, name, owner_id)
values (
  'attachments',
  tests.workspace_id('alpha')::text || '/00000000-0000-4000-8000-000000000201/00000000-0000-4000-8000-000000000301-alice.txt',
  tests.user_id('alice')::text
);

insert into public.attachments (
  id,
  task_id,
  workspace_id,
  uploader_id,
  object_path,
  file_name,
  content_type,
  size_bytes
)
values (
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000201',
  tests.workspace_id('alpha'),
  tests.user_id('alice'),
  tests.workspace_id('alpha')::text || '/00000000-0000-4000-8000-000000000201/00000000-0000-4000-8000-000000000301-alice.txt',
  'alice.txt',
  'text/plain',
  5
);

select tests.authenticate_as('bob');
set local role authenticated;

select is(
  (select count(*)::integer from public.attachments),
  1,
  'workspace members can list attachment metadata'
);

select is(
  (select count(*)::integer from storage.objects where bucket_id = 'attachments'),
  1,
  'workspace members can select attachment objects'
);

select lives_ok(
  format(
    'insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)',
    'attachments',
    tests.workspace_id('alpha')::text || '/00000000-0000-4000-8000-000000000201/00000000-0000-4000-8000-000000000302-bob.pdf',
    tests.user_id('bob')::text
  ),
  'workspace members can upload attachment objects'
);

select lives_ok(
  format(
    'insert into public.attachments (task_id, workspace_id, uploader_id, object_path, file_name, content_type, size_bytes) values (%L, %L, %L, %L, %L, %L, %L)',
    '00000000-0000-4000-8000-000000000201',
    tests.workspace_id('alpha'),
    tests.user_id('bob'),
    tests.workspace_id('alpha')::text || '/00000000-0000-4000-8000-000000000201/00000000-0000-4000-8000-000000000302-bob.pdf',
    'bob.pdf',
    'application/pdf',
    10
  ),
  'workspace members can create their own attachment metadata'
);

select lives_ok(
  $$delete from public.attachments where id = '00000000-0000-4000-8000-000000000401'$$,
  'unauthorized metadata delete does not reveal attachment existence'
);

reset role;

select is(
  private.is_task_attachment_owner(
    tests.workspace_id('alpha')::text || '/00000000-0000-4000-8000-000000000201/00000000-0000-4000-8000-000000000301-alice.txt'
  ),
  false,
  'regular members do not receive Owner object-delete authorization'
);

select is(
  (select count(*)::integer from public.attachments where id = '00000000-0000-4000-8000-000000000401'),
  1,
  'Bob cannot delete Alice attachment metadata'
);

select tests.authenticate_as('alice');
set local role authenticated;

select lives_ok(
  $$delete from public.attachments where uploader_id = tests.user_id('bob')$$,
  'workspace Owner can delete member attachment metadata'
);

reset role;

select is(
  private.is_task_attachment_owner(
    tests.workspace_id('alpha')::text || '/00000000-0000-4000-8000-000000000201/00000000-0000-4000-8000-000000000302-bob.pdf'
  ),
  true,
  'workspace Owner receives object-delete authorization'
);
select tests.authenticate_as('charlie');
set local role authenticated;

select is(
  (select count(*)::integer from public.attachments),
  0,
  'non-members cannot list attachment metadata'
);

select throws_ok(
  format(
    'insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)',
    'attachments',
    tests.workspace_id('alpha')::text || '/00000000-0000-4000-8000-000000000201/00000000-0000-4000-8000-000000000303-charlie.txt',
    tests.user_id('charlie')::text
  ),
  '42501',
  null,
  'non-members cannot upload attachment objects'
);

reset role;

select * from finish();
rollback;
