begin;

\ir ./_helpers.psql

select no_plan();

select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ),
  'tasks belongs to the supabase_realtime publication'
);

select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comments'
  ),
  'comments belongs to the supabase_realtime publication'
);

select has_function(
  'private',
  'is_workspace_topic_member',
  array['text'],
  'private.is_workspace_topic_member(text) exists'
);

select is(
  (
    select prosecdef
    from pg_proc
    where oid = 'private.is_workspace_topic_member(text)'::regprocedure
  ),
  true,
  'workspace topic membership helper is security definer'
);

select is(
  (
    select proconfig
    from pg_proc
    where oid = 'private.is_workspace_topic_member(text)'::regprocedure
  ),
  array['search_path=""'],
  'workspace topic membership helper has an empty search path'
);

select ok(
  not has_function_privilege(
    'public',
    'private.is_workspace_topic_member(text)',
    'execute'
  ),
  'PUBLIC cannot execute workspace topic membership helper'
);

select ok(
  has_function_privilege(
    'authenticated',
    'private.is_workspace_topic_member(text)',
    'execute'
  ),
  'authenticated can execute workspace topic membership helper'
);

select has_function(
  'private',
  'is_workspace_postgres_topic_member',
  array['text'],
  'private.is_workspace_postgres_topic_member(text) exists'
);

select is(
  (
    select prosecdef
    from pg_proc
    where oid = 'private.is_workspace_postgres_topic_member(text)'::regprocedure
  ),
  true,
  'workspace postgres topic membership helper is security definer'
);

select is(
  (
    select proconfig
    from pg_proc
    where oid = 'private.is_workspace_postgres_topic_member(text)'::regprocedure
  ),
  array['search_path=""'],
  'workspace postgres topic membership helper has an empty search path'
);

select ok(
  not has_function_privilege(
    'public',
    'private.is_workspace_postgres_topic_member(text)',
    'execute'
  ),
  'PUBLIC cannot execute workspace postgres topic membership helper'
);

select ok(
  has_function_privilege(
    'authenticated',
    'private.is_workspace_postgres_topic_member(text)',
    'execute'
  ),
  'authenticated can execute workspace postgres topic membership helper'
);

select has_trigger(
  'public',
  'tasks',
  'broadcast_task_deleted',
  'tasks has a delete broadcast trigger'
);

select has_trigger(
  'public',
  'comments',
  'broadcast_comment_deleted',
  'comments has a delete broadcast trigger'
);

select is(
  (
    select prosecdef
    from pg_proc
    where oid = 'private.broadcast_workspace_delete()'::regprocedure
  ),
  true,
  'delete broadcast trigger function is security definer'
);

select is(
  (
    select proconfig
    from pg_proc
    where oid = 'private.broadcast_workspace_delete()'::regprocedure
  ),
  array['search_path=""'],
  'delete broadcast trigger function has an empty search path'
);

select ok(
  not has_function_privilege(
    'public',
    'private.broadcast_workspace_delete()',
    'execute'
  ),
  'PUBLIC cannot execute the delete broadcast trigger function'
);

select ok(
  (
    select position('auth.uid' in prosrc) > 0
    from pg_proc
    where oid = 'private.broadcast_workspace_delete()'::regprocedure
  ),
  'delete broadcast definer verifies an authenticated workspace member'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'Workspace members can receive delete broadcasts'
      and cmd = 'SELECT'
      and roles = array['authenticated'::name]
  ),
  1,
  'workspace delete broadcast read policy targets authenticated users'
);

select ok(
  (
    select qual ~ 'extension.*broadcast'
      and qual ~ 'is_workspace_topic_member'
    from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'Workspace members can receive delete broadcasts'
  ),
  'workspace delete broadcast policy restricts extension and workspace membership'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'Workspace members can subscribe to postgres changes'
      and cmd = 'SELECT'
      and roles = array['authenticated'::name]
      and qual ~ 'is_workspace_postgres_topic_member'
  ),
  1,
  'private postgres changes policy targets authenticated workspace members'
);

create temporary table test_realtime_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update, delete on table test_realtime_ids to authenticated;

select tests.authenticate_as('alice');
set local role authenticated;

insert into test_realtime_ids (key, id)
values ('alpha', public.create_workspace('Realtime Alpha'));

insert into public.workspace_members (workspace_id, user_id, role, added_by)
values (
  (select id from test_realtime_ids where key = 'alpha'),
  tests.user_id('bob'),
  'member',
  tests.user_id('alice')
);

reset role;
select tests.authenticate_as('charlie');
set local role authenticated;

insert into test_realtime_ids (key, id)
values ('beta', public.create_workspace('Realtime Beta'));

reset role;
select tests.authenticate_as('alice');

select ok(
  private.is_workspace_topic_member(
    'workspace:' || (select id from test_realtime_ids where key = 'alpha')::text
  ),
  'workspace owner can access the workspace topic'
);

select ok(
  private.is_workspace_postgres_topic_member(
    'workspace-postgres:' || (select id from test_realtime_ids where key = 'alpha')::text
  ),
  'workspace owner can access the private postgres changes topic'
);

select tests.authenticate_as('bob');

select ok(
  private.is_workspace_topic_member(
    'workspace:' || (select id from test_realtime_ids where key = 'alpha')::text
  ),
  'workspace member can access the workspace topic'
);

select ok(
  private.is_workspace_postgres_topic_member(
    'workspace-postgres:' || (select id from test_realtime_ids where key = 'alpha')::text
  ),
  'workspace member can access the private postgres changes topic'
);

select tests.authenticate_as('charlie');

select ok(
  not private.is_workspace_topic_member(
    'workspace:' || (select id from test_realtime_ids where key = 'alpha')::text
  ),
  'non-member cannot access another workspace topic'
);

select ok(
  not private.is_workspace_postgres_topic_member(
    'workspace-postgres:' || (select id from test_realtime_ids where key = 'alpha')::text
  ),
  'non-member cannot access another workspace private postgres changes topic'
);

select ok(
  not private.is_workspace_topic_member('workspace:not-a-uuid'),
  'malformed workspace topics are rejected without casting errors'
);

select ok(
  not private.is_workspace_postgres_topic_member('workspace-postgres:not-a-uuid'),
  'malformed workspace postgres topics are rejected without casting errors'
);

select ok(
  not private.is_workspace_topic_member(
    'other:' || (select id from test_realtime_ids where key = 'beta')::text
  ),
  'unexpected topic prefixes are rejected'
);

reset role;
select tests.authenticate_as('alice');
set local role authenticated;

with inserted as (
  insert into public.tasks (workspace_id, title, created_by)
  values (
    (select id from test_realtime_ids where key = 'alpha'),
    'Realtime task',
    tests.user_id('alice')
  )
  returning id
)
insert into test_realtime_ids (key, id)
select 'task', id from inserted;

with inserted as (
  insert into public.comments (task_id, workspace_id, author_id, body)
  values (
    (select id from test_realtime_ids where key = 'task'),
    (select id from test_realtime_ids where key = 'alpha'),
    tests.user_id('alice'),
    'Realtime comment'
  )
  returning id
)
insert into test_realtime_ids (key, id)
select 'comment', id from inserted;

delete from public.comments
where id = (select id from test_realtime_ids where key = 'comment');

delete from public.tasks
where id = (select id from test_realtime_ids where key = 'task');

reset role;

select is(
  (
    select count(*)::integer
    from realtime.messages
    where topic = 'workspace:' || (
      select id from test_realtime_ids where key = 'alpha'
    )::text
      and extension = 'broadcast'
      and event = 'DELETE'
      and private is true
      and payload = jsonb_build_object(
        'table', 'comments',
        'id', (select id from test_realtime_ids where key = 'comment')
      )
  ),
  1,
  'comment deletion broadcasts only its table and primary key'
);

select is(
  (
    select count(*)::integer
    from realtime.messages
    where topic = 'workspace:' || (
      select id from test_realtime_ids where key = 'alpha'
    )::text
      and extension = 'broadcast'
      and event = 'DELETE'
      and private is true
      and payload = jsonb_build_object(
        'table', 'tasks',
        'id', (select id from test_realtime_ids where key = 'task')
      )
  ),
  1,
  'task deletion broadcasts only its table and primary key'
);

select * from finish();

rollback;
