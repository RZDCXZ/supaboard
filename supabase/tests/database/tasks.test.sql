begin;

\ir ./_helpers.psql

select no_plan();

select has_table('public', 'tasks', 'tasks table exists');
select has_column('public', 'tasks', 'id', 'tasks.id exists');
select has_column('public', 'tasks', 'workspace_id', 'tasks.workspace_id exists');
select has_column('public', 'tasks', 'title', 'tasks.title exists');
select has_column('public', 'tasks', 'description', 'tasks.description exists');
select has_column('public', 'tasks', 'status', 'tasks.status exists');
select has_column('public', 'tasks', 'priority', 'tasks.priority exists');
select has_column('public', 'tasks', 'assignee_id', 'tasks.assignee_id exists');
select has_column('public', 'tasks', 'created_by', 'tasks.created_by exists');
select has_column('public', 'tasks', 'created_at', 'tasks.created_at exists');
select has_column('public', 'tasks', 'updated_at', 'tasks.updated_at exists');
select has_view('public', 'workspace_task_stats', 'workspace_task_stats view exists');
select has_function(
  'public',
  'get_workspace_stats',
  array['uuid'],
  'get_workspace_stats(uuid) exists'
);

create temporary table test_task_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update, delete on table test_task_ids to authenticated;

select tests.authenticate_as('alice');
set local role authenticated;

insert into test_task_ids (key, id)
values ('alpha', public.create_workspace('Alpha'));

insert into public.workspace_members (workspace_id, user_id, role, added_by)
values (
  (select id from test_task_ids where key = 'alpha'),
  '00000000-0000-4000-8000-000000000012',
  'member',
  '00000000-0000-4000-8000-000000000011'
);

reset role;
select tests.authenticate_as('charlie');
set local role authenticated;

insert into test_task_ids (key, id)
values ('beta', public.create_workspace('Beta'));

reset role;
select tests.clear_authentication();
set local role anon;

select throws_ok(
  $$select * from public.tasks$$,
  '42501',
  null,
  'anonymous users have no tasks table access'
);

select throws_ok(
  $$select * from public.workspace_task_stats$$,
  '42501',
  null,
  'anonymous users have no task stats view access'
);

select throws_ok(
  $$select * from public.get_workspace_stats('00000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'anonymous users cannot execute get_workspace_stats'
);

reset role;
select tests.authenticate_as('alice');
set local role authenticated;

select lives_ok(
  $$insert into test_task_ids (key, id)
    select 'default-task', id
    from public.tasks
    where false$$,
  'temporary task id table remains writable by authenticated tests'
);

with inserted as (
  insert into public.tasks (workspace_id, title, created_by)
  values (
    (select id from test_task_ids where key = 'alpha'),
    'Default task',
    '00000000-0000-4000-8000-000000000011'
  )
  returning id
)
insert into test_task_ids (key, id)
select 'default-task', id from inserted;

reset role;

select is(
  (select status from public.tasks where id = (select id from test_task_ids where key = 'default-task')),
  'todo',
  'new tasks default to todo'
);

select is(
  (select priority from public.tasks where id = (select id from test_task_ids where key = 'default-task')),
  'medium',
  'new tasks default to medium priority'
);

select ok(
  (select created_at is not null and updated_at is not null
   from public.tasks where id = (select id from test_task_ids where key = 'default-task')),
  'new tasks receive timestamps'
);

select tests.authenticate_as('alice');
set local role authenticated;

select throws_ok(
  $$insert into public.tasks (workspace_id, title, created_by)
    values (
      (select id from test_task_ids where key = 'alpha'),
      '   ',
      '00000000-0000-4000-8000-000000000011'
    )$$,
  '23514',
  null,
  'blank task titles are rejected'
);

select throws_ok(
  $$insert into public.tasks (workspace_id, title, created_by)
    values (
      (select id from test_task_ids where key = 'alpha'),
      repeat('x', 201),
      '00000000-0000-4000-8000-000000000011'
    )$$,
  '23514',
  null,
  'task titles longer than 200 characters are rejected'
);

select throws_ok(
  $$insert into public.tasks (workspace_id, title, description, created_by)
    values (
      (select id from test_task_ids where key = 'alpha'),
      'Long description',
      repeat('x', 5001),
      '00000000-0000-4000-8000-000000000011'
    )$$,
  '23514',
  null,
  'task descriptions longer than 5000 characters are rejected'
);

select throws_ok(
  $$insert into public.tasks (workspace_id, title, status, created_by)
    values (
      (select id from test_task_ids where key = 'alpha'),
      'Invalid status',
      'blocked',
      '00000000-0000-4000-8000-000000000011'
    )$$,
  '23514',
  null,
  'invalid task statuses are rejected'
);

select throws_ok(
  $$insert into public.tasks (workspace_id, title, priority, created_by)
    values (
      (select id from test_task_ids where key = 'alpha'),
      'Invalid priority',
      'urgent',
      '00000000-0000-4000-8000-000000000011'
    )$$,
  '23514',
  null,
  'invalid task priorities are rejected'
);

select throws_ok(
  $$insert into public.tasks (workspace_id, title, assignee_id, created_by)
    values (
      (select id from test_task_ids where key = 'alpha'),
      'Invalid assignee',
      '00000000-0000-4000-8000-000000000013',
      '00000000-0000-4000-8000-000000000011'
    )$$,
  '23514',
  null,
  'tasks cannot be assigned outside the workspace'
);

select throws_ok(
  $$insert into public.tasks (workspace_id, title, created_by)
    values (
      (select id from test_task_ids where key = 'alpha'),
      'Wrong creator',
      '00000000-0000-4000-8000-000000000012'
    )$$,
  '42501',
  null,
  'members cannot create tasks for another user'
);

with inserted as (
  insert into public.tasks (workspace_id, title, assignee_id, created_by)
  values (
    (select id from test_task_ids where key = 'alpha'),
    'Assigned task',
    '00000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000011'
  )
  returning id
)
insert into test_task_ids (key, id)
select 'assigned-task', id from inserted;

select is(
  (
    select total
    from public.get_workspace_stats((select id from test_task_ids where key = 'alpha'))
  ),
  2::bigint,
  'workspace stats include all visible tasks'
);

select is(
  (
    select todo
    from public.workspace_task_stats
    where workspace_id = (select id from test_task_ids where key = 'alpha')
  ),
  2::bigint,
  'security invoker task stats view reports visible todo tasks'
);

reset role;
select tests.authenticate_as('bob');
set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.tasks
    where workspace_id = (select id from test_task_ids where key = 'alpha')
  ),
  2,
  'workspace members can read tasks'
);

select lives_ok(
  $$update public.tasks
    set title = 'Bob updated', status = 'done', priority = 'high', assignee_id = null
    where id = (select id from test_task_ids where key = 'assigned-task')$$,
  'workspace members can update editable task fields'
);

reset role;

select is(
  (select title from public.tasks where id = (select id from test_task_ids where key = 'assigned-task')),
  'Bob updated',
  'member task updates are persisted'
);

select ok(
  (
    select updated_at >= created_at
    from public.tasks
    where id = (select id from test_task_ids where key = 'assigned-task')
  ),
  'task updates maintain updated_at'
);

select tests.authenticate_as('bob');
set local role authenticated;

select throws_ok(
  $$update public.tasks
    set workspace_id = (select id from test_task_ids where key = 'beta')
    where id = (select id from test_task_ids where key = 'assigned-task')$$,
  'P0001',
  null,
  'task workspace cannot be rebound'
);

select throws_ok(
  $$update public.tasks
    set created_by = '00000000-0000-4000-8000-000000000012'
    where id = (select id from test_task_ids where key = 'assigned-task')$$,
  'P0001',
  null,
  'task creator cannot be rebound'
);

select throws_ok(
  $$update public.tasks
    set id = gen_random_uuid()
    where id = (select id from test_task_ids where key = 'assigned-task')$$,
  'P0001',
  null,
  'task id cannot be rebound'
);

reset role;
select tests.authenticate_as('charlie');
set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.tasks
    where workspace_id = (select id from test_task_ids where key = 'alpha')
  ),
  0,
  'non-members cannot read tasks by guessing the workspace id'
);

select is(
  (
    select count(*)::integer
    from public.workspace_task_stats
    where workspace_id = (select id from test_task_ids where key = 'alpha')
  ),
  0,
  'security invoker view does not expose another workspace stats'
);

select throws_ok(
  $$select *
    from public.get_workspace_stats((select id from test_task_ids where key = 'alpha'))$$,
  '42501',
  null,
  'non-members cannot execute stats for another workspace'
);

select lives_ok(
  $$delete from public.tasks
    where id = (select id from test_task_ids where key = 'default-task')$$,
  'non-member task deletes do not reveal an authorization error'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.tasks
    where id = (select id from test_task_ids where key = 'default-task')
  ),
  1,
  'non-members cannot delete tasks'
);

select tests.authenticate_as('bob');
set local role authenticated;

select lives_ok(
  $$delete from public.tasks
    where id = (select id from test_task_ids where key = 'assigned-task')$$,
  'workspace members can delete tasks'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.tasks
    where id = (select id from test_task_ids where key = 'assigned-task')
  ),
  0,
  'member task deletes are persisted'
);

select * from finish();
rollback;
