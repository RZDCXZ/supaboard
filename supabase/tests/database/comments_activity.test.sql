begin;

\ir ./_helpers.psql

select no_plan();

select has_table('public', 'comments', 'comments table exists');
select has_column('public', 'comments', 'task_id', 'comments.task_id exists');
select has_column('public', 'comments', 'workspace_id', 'comments.workspace_id exists');
select has_column('public', 'comments', 'author_id', 'comments.author_id exists');
select has_column('public', 'comments', 'body', 'comments.body exists');
select has_table('public', 'activity_logs', 'activity_logs table exists');
select has_column('public', 'activity_logs', 'actor_id', 'activity_logs.actor_id exists');
select has_column('public', 'activity_logs', 'action', 'activity_logs.action exists');
select has_column('public', 'activity_logs', 'entity_id', 'activity_logs.entity_id exists');
select has_column('public', 'activity_logs', 'metadata', 'activity_logs.metadata exists');

create temporary table test_stage8_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update, delete on table test_stage8_ids to authenticated;

select tests.authenticate_as('alice');
set local role authenticated;

insert into test_stage8_ids (key, id)
values
  ('alpha', public.create_workspace('Alpha')),
  ('gamma', public.create_workspace('Gamma'));

insert into public.workspace_members (workspace_id, user_id, role, added_by)
values (
  (select id from test_stage8_ids where key = 'alpha'),
  '00000000-0000-4000-8000-000000000012',
  'member',
  '00000000-0000-4000-8000-000000000011'
);

with inserted as (
  insert into public.tasks (workspace_id, title, created_by)
  values (
    (select id from test_stage8_ids where key = 'alpha'),
    'Alpha task',
    '00000000-0000-4000-8000-000000000011'
  )
  returning id
)
insert into test_stage8_ids (key, id)
select 'alpha-task', id from inserted;

reset role;
select tests.authenticate_as('charlie');
set local role authenticated;

insert into test_stage8_ids (key, id)
values ('beta', public.create_workspace('Beta'));

with inserted as (
  insert into public.tasks (workspace_id, title, created_by)
  values (
    (select id from test_stage8_ids where key = 'beta'),
    'Beta task',
    '00000000-0000-4000-8000-000000000013'
  )
  returning id
)
insert into test_stage8_ids (key, id)
select 'beta-task', id from inserted;

reset role;
select tests.clear_authentication();
set local role anon;

select throws_ok(
  $$select * from public.comments$$,
  '42501',
  null,
  'anonymous users have no comments table access'
);

select throws_ok(
  $$select * from public.activity_logs$$,
  '42501',
  null,
  'anonymous users have no activity log access'
);

reset role;
select tests.authenticate_as('alice');
set local role authenticated;

select throws_ok(
  $$insert into public.comments (task_id, workspace_id, author_id, body)
    values (
      (select id from test_stage8_ids where key = 'alpha-task'),
      (select id from test_stage8_ids where key = 'alpha'),
      '00000000-0000-4000-8000-000000000011',
      '   '
    )$$,
  '23514',
  null,
  'blank comments are rejected'
);

select throws_ok(
  $$insert into public.comments (task_id, workspace_id, author_id, body)
    values (
      (select id from test_stage8_ids where key = 'alpha-task'),
      (select id from test_stage8_ids where key = 'alpha'),
      '00000000-0000-4000-8000-000000000011',
      repeat('x', 2001)
    )$$,
  '23514',
  null,
  'comments longer than 2000 characters are rejected'
);

select throws_ok(
  $$insert into public.comments (task_id, workspace_id, author_id, body)
    values (
      (select id from test_stage8_ids where key = 'alpha-task'),
      (select id from test_stage8_ids where key = 'alpha'),
      '00000000-0000-4000-8000-000000000012',
      'Forged author'
    )$$,
  '42501',
  null,
  'members cannot create comments for another author'
);

select throws_ok(
  $$insert into public.comments (task_id, workspace_id, author_id, body)
    values (
      (select id from test_stage8_ids where key = 'alpha-task'),
      (select id from test_stage8_ids where key = 'gamma'),
      '00000000-0000-4000-8000-000000000011',
      'Cross-workspace comment'
    )$$,
  '23503',
  null,
  'the composite foreign key rejects mismatched task and workspace ids'
);

with inserted as (
  insert into public.comments (task_id, workspace_id, author_id, body)
  values (
    (select id from test_stage8_ids where key = 'alpha-task'),
    (select id from test_stage8_ids where key = 'alpha'),
    '00000000-0000-4000-8000-000000000011',
    'Alice comment'
  )
  returning id
)
insert into test_stage8_ids (key, id)
select 'alice-comment', id from inserted;

reset role;
select tests.authenticate_as('bob');
set local role authenticated;

with inserted as (
  insert into public.comments (task_id, workspace_id, author_id, body)
  values (
    (select id from test_stage8_ids where key = 'alpha-task'),
    (select id from test_stage8_ids where key = 'alpha'),
    '00000000-0000-4000-8000-000000000012',
    'Bob comment'
  )
  returning id
)
insert into test_stage8_ids (key, id)
select 'bob-comment', id from inserted;

select is(
  (
    select count(*)::integer
    from public.comments
    where workspace_id = (select id from test_stage8_ids where key = 'alpha')
  ),
  2,
  'workspace members can read all task comments'
);

select lives_ok(
  $$update public.comments
    set body = 'Bob cannot edit Alice'
    where id = (select id from test_stage8_ids where key = 'alice-comment')$$,
  'updating another author comment does not leak an authorization error'
);

select lives_ok(
  $$update public.comments
    set body = 'Bob updated comment'
    where id = (select id from test_stage8_ids where key = 'bob-comment')$$,
  'authors can update their own comments'
);

reset role;

select is(
  (select body from public.comments where id = (select id from test_stage8_ids where key = 'alice-comment')),
  'Alice comment',
  'another member cannot update the author comment'
);

select is(
  (select body from public.comments where id = (select id from test_stage8_ids where key = 'bob-comment')),
  'Bob updated comment',
  'author comment updates are persisted'
);

select throws_ok(
  $$update public.comments
    set workspace_id = (select id from test_stage8_ids where key = 'gamma')
    where id = (select id from test_stage8_ids where key = 'bob-comment')$$,
  'P0001',
  null,
  'comment workspace cannot be rebound'
);

select throws_ok(
  $$update public.comments
    set author_id = '00000000-0000-4000-8000-000000000011'
    where id = (select id from test_stage8_ids where key = 'bob-comment')$$,
  'P0001',
  null,
  'comment author cannot be rebound'
);

select tests.authenticate_as('bob');
set local role authenticated;

select lives_ok(
  $$delete from public.comments
    where id = (select id from test_stage8_ids where key = 'alice-comment')$$,
  'members cannot tell whether another author comment is deletable'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.comments
    where id = (select id from test_stage8_ids where key = 'alice-comment')
  ),
  1,
  'members cannot delete another author comment'
);

select tests.authenticate_as('alice');
set local role authenticated;

select lives_ok(
  $$delete from public.comments
    where id = (select id from test_stage8_ids where key = 'bob-comment')$$,
  'workspace owners can delete another author comment'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.comments
    where id = (select id from test_stage8_ids where key = 'bob-comment')
  ),
  0,
  'owner comment deletes are persisted'
);

select tests.authenticate_as('charlie');
set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.comments
    where workspace_id = (select id from test_stage8_ids where key = 'alpha')
  ),
  0,
  'non-members cannot read comments by guessing a workspace id'
);

select throws_ok(
  $$insert into public.comments (task_id, workspace_id, author_id, body)
    values (
      (select id from test_stage8_ids where key = 'alpha-task'),
      (select id from test_stage8_ids where key = 'alpha'),
      '00000000-0000-4000-8000-000000000013',
      'Charlie comment'
    )$$,
  '42501',
  null,
  'non-members cannot comment in another workspace'
);

reset role;
select tests.authenticate_as('bob');
set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.activity_logs
    where workspace_id = (select id from test_stage8_ids where key = 'alpha')
      and action = 'task.created'
  ),
  1,
  'task creation produces one member-visible activity log'
);

select lives_ok(
  $$update public.tasks
    set title = 'Alpha task renamed'
    where id = (select id from test_stage8_ids where key = 'alpha-task')$$,
  'members can update non-status task fields'
);

select is(
  (
    select count(*)::integer
    from public.activity_logs
    where workspace_id = (select id from test_stage8_ids where key = 'alpha')
  ),
  1,
  'non-status task updates do not produce activity logs'
);

select lives_ok(
  $$update public.tasks
    set status = 'done'
    where id = (select id from test_stage8_ids where key = 'alpha-task')$$,
  'members can update task status'
);

select is(
  (
    select count(*)::integer
    from public.activity_logs
    where workspace_id = (select id from test_stage8_ids where key = 'alpha')
      and action = 'task.status_changed'
  ),
  1,
  'an actual status change produces exactly one activity log'
);

select is(
  (
    select metadata
    from public.activity_logs
    where workspace_id = (select id from test_stage8_ids where key = 'alpha')
      and action = 'task.status_changed'
  ),
  '{"title":"Alpha task renamed","from_status":"todo","to_status":"done"}'::jsonb,
  'status activity stores the documented metadata'
);

select is(
  (
    select actor_id
    from public.activity_logs
    where workspace_id = (select id from test_stage8_ids where key = 'alpha')
      and action = 'task.status_changed'
  ),
  '00000000-0000-4000-8000-000000000012'::uuid,
  'status activity records the authenticated actor'
);

select lives_ok(
  $$update public.tasks
    set status = 'done'
    where id = (select id from test_stage8_ids where key = 'alpha-task')$$,
  'setting the same status remains a valid task update'
);

select is(
  (
    select count(*)::integer
    from public.activity_logs
    where workspace_id = (select id from test_stage8_ids where key = 'alpha')
      and action = 'task.status_changed'
  ),
  1,
  'setting the same status does not duplicate activity'
);

select throws_ok(
  $$insert into public.activity_logs (
      workspace_id, actor_id, action, entity_type, entity_id, metadata
    ) values (
      (select id from test_stage8_ids where key = 'alpha'),
      '00000000-0000-4000-8000-000000000012',
      'task.deleted',
      'task',
      gen_random_uuid(),
      '{}'::jsonb
    )$$,
  '42501',
  null,
  'authenticated clients cannot forge activity logs'
);

select throws_ok(
  $$update public.activity_logs
    set metadata = '{"forged":true}'::jsonb
    where workspace_id = (select id from test_stage8_ids where key = 'alpha')$$,
  '42501',
  null,
  'authenticated clients cannot edit activity logs'
);

select throws_ok(
  $$delete from public.activity_logs
    where workspace_id = (select id from test_stage8_ids where key = 'alpha')$$,
  '42501',
  null,
  'authenticated clients cannot delete activity logs'
);

reset role;
set local role service_role;

select throws_ok(
  $$insert into public.activity_logs (
      workspace_id, actor_id, action, entity_type, entity_id, metadata
    ) values (
      (select id from test_stage8_ids where key = 'alpha'),
      '00000000-0000-4000-8000-000000000012',
      'task.deleted',
      'task',
      gen_random_uuid(),
      '{}'::jsonb
    )$$,
  '42501',
  null,
  'service role clients cannot forge activity logs'
);

reset role;
select tests.authenticate_as('bob');
set local role authenticated;

select lives_ok(
  $$delete from public.tasks
    where id = (select id from test_stage8_ids where key = 'alpha-task')$$,
  'workspace members can delete tasks'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.activity_logs
    where workspace_id = (select id from test_stage8_ids where key = 'alpha')
  ),
  3,
  'task deletion adds an activity log without deleting earlier logs'
);

select is(
  (
    select metadata
    from public.activity_logs
    where workspace_id = (select id from test_stage8_ids where key = 'alpha')
      and action = 'task.deleted'
  ),
  '{"title":"Alpha task renamed","status":"done"}'::jsonb,
  'deleted task activity retains title and status metadata'
);

select is(
  (
    select entity_id
    from public.activity_logs
    where workspace_id = (select id from test_stage8_ids where key = 'alpha')
      and action = 'task.deleted'
  ),
  (select id from test_stage8_ids where key = 'alpha-task'),
  'deleted task activity retains the task id without a foreign key'
);

select is(
  (
    select count(*)::integer
    from public.comments
    where task_id = (select id from test_stage8_ids where key = 'alpha-task')
  ),
  0,
  'deleting a task cascades its comments'
);

select set_config('request.jwt.claim.sub', '', true);

insert into public.tasks (workspace_id, title, created_by)
values (
  (select id from test_stage8_ids where key = 'gamma'),
  'System task',
  '00000000-0000-4000-8000-000000000011'
);

select is(
  (
    select actor_id
    from public.activity_logs
    where workspace_id = (select id from test_stage8_ids where key = 'gamma')
      and action = 'task.created'
  ),
  null,
  'database operations without a user record a system actor'
);

select * from finish();
rollback;
