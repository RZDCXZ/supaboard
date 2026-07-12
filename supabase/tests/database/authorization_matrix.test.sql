begin;

\ir ./_helpers.psql

select no_plan();

create or replace function tests.affected_rows(statement text)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  affected integer;
begin
  execute statement;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

grant execute on function tests.affected_rows(text) to authenticated;

insert into public.tasks (id, workspace_id, title, created_by)
values (
  '00000000-0000-4000-8000-000000000501',
  tests.workspace_id('alpha'),
  'Authorization matrix task',
  tests.user_id('alice')
);

insert into public.comments (id, task_id, workspace_id, author_id, body)
values (
  '00000000-0000-4000-8000-000000000502',
  '00000000-0000-4000-8000-000000000501',
  tests.workspace_id('alpha'),
  tests.user_id('alice'),
  'Authorization matrix comment'
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
  '00000000-0000-4000-8000-000000000503',
  '00000000-0000-4000-8000-000000000501',
  tests.workspace_id('alpha'),
  tests.user_id('alice'),
  tests.workspace_id('alpha')::text || '/00000000-0000-4000-8000-000000000501/00000000-0000-4000-8000-000000000504-matrix.txt',
  'matrix.txt',
  'text/plain',
  6
);

select tests.authenticate_as('charlie');
set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.profiles
    where id in (
      tests.user_id('alice'),
      tests.user_id('bob'),
      tests.user_id('charlie')
    )
  ),
  3,
  'Charlie can read authenticated public profiles'
);

select is(
  (select count(*)::integer from public.workspaces where id = tests.workspace_id('alpha')),
  0,
  'Charlie cannot select the Alpha workspace'
);

select is(
  (select count(*)::integer from public.workspace_members where workspace_id = tests.workspace_id('alpha')),
  0,
  'Charlie cannot select Alpha memberships'
);

select is(
  (select count(*)::integer from public.tasks where workspace_id = tests.workspace_id('alpha')),
  0,
  'Charlie cannot select Alpha tasks'
);

select is(
  (select count(*)::integer from public.comments where workspace_id = tests.workspace_id('alpha')),
  0,
  'Charlie cannot select Alpha comments'
);

select is(
  (select count(*)::integer from public.activity_logs where workspace_id = tests.workspace_id('alpha')),
  0,
  'Charlie cannot select Alpha activity logs'
);

select is(
  (select count(*)::integer from public.attachments where workspace_id = tests.workspace_id('alpha')),
  0,
  'Charlie cannot select Alpha attachment metadata'
);

select throws_ok(
  $$insert into public.profiles (id, display_name) values (gen_random_uuid(), 'Forged')$$,
  '42501',
  null,
  'authenticated clients cannot insert profiles directly'
);

select lives_ok(
  $$insert into public.workspaces (id, name, owner_id)
    values (
      '00000000-0000-4000-8000-000000000601',
      'Charlie Matrix',
      tests.user_id('charlie')
    )$$,
  'Charlie can insert a workspace owned by Charlie'
);

select lives_ok(
  $$insert into public.workspace_members (workspace_id, user_id, role)
    values (
      '00000000-0000-4000-8000-000000000601',
      tests.user_id('charlie'),
      'owner'
    )$$,
  'Charlie can insert the matching owner membership'
);

select throws_ok(
  $$insert into public.workspace_members (workspace_id, user_id, role, added_by)
    values (
      tests.workspace_id('alpha'),
      tests.user_id('charlie'),
      'member',
      tests.user_id('charlie')
    )$$,
  '42501',
  null,
  'Charlie cannot insert an Alpha membership'
);

select throws_ok(
  $$insert into public.tasks (workspace_id, title, created_by)
    values (tests.workspace_id('alpha'), 'Forged task', tests.user_id('charlie'))$$,
  '42501',
  null,
  'Charlie cannot insert an Alpha task'
);

select throws_ok(
  $$insert into public.comments (task_id, workspace_id, author_id, body)
    values (
      '00000000-0000-4000-8000-000000000501',
      tests.workspace_id('alpha'),
      tests.user_id('charlie'),
      'Forged comment'
    )$$,
  '42501',
  null,
  'Charlie cannot insert an Alpha comment'
);

select throws_ok(
  $$insert into public.activity_logs (
      workspace_id, actor_id, action, entity_id
    ) values (
      tests.workspace_id('alpha'),
      tests.user_id('charlie'),
      'task.created',
      gen_random_uuid()
    )$$,
  '42501',
  null,
  'authenticated clients cannot insert activity logs directly'
);

select throws_ok(
  $$insert into public.attachments (
      task_id, workspace_id, uploader_id, object_path, file_name, content_type, size_bytes
    ) values (
      '00000000-0000-4000-8000-000000000501',
      tests.workspace_id('alpha'),
      tests.user_id('charlie'),
      tests.workspace_id('alpha')::text || '/00000000-0000-4000-8000-000000000501/00000000-0000-4000-8000-000000000505-charlie.txt',
      'charlie.txt',
      'text/plain',
      7
    )$$,
  '42501',
  null,
  'Charlie cannot insert Alpha attachment metadata'
);

select is(
  tests.affected_rows(
    $$update public.profiles set display_name = 'Forged' where id = tests.user_id('alice')$$
  ),
  0,
  'Charlie cannot update Alice profile'
);

select is(
  tests.affected_rows(
    $$update public.workspaces set name = 'Forged' where id = tests.workspace_id('alpha')$$
  ),
  0,
  'Charlie cannot update Alpha'
);

select is(
  tests.affected_rows(
    $$update public.workspace_members set added_by = tests.user_id('charlie')
      where workspace_id = tests.workspace_id('alpha') and user_id = tests.user_id('bob')$$
  ),
  0,
  'Charlie cannot update Alpha memberships'
);

select is(
  tests.affected_rows(
    $$update public.tasks set title = 'Forged'
      where id = '00000000-0000-4000-8000-000000000501'$$
  ),
  0,
  'Charlie cannot update Alpha tasks'
);

select is(
  tests.affected_rows(
    $$update public.comments set body = 'Forged'
      where id = '00000000-0000-4000-8000-000000000502'$$
  ),
  0,
  'Charlie cannot update Alpha comments'
);

select throws_ok(
  $$update public.activity_logs set metadata = '{"forged":true}'::jsonb
    where workspace_id = tests.workspace_id('alpha')$$,
  '42501',
  null,
  'authenticated clients cannot update activity logs directly'
);

select throws_ok(
  $$update public.attachments set file_name = 'forged.txt'
    where id = '00000000-0000-4000-8000-000000000503'$$,
  '42501',
  null,
  'authenticated clients cannot update attachment metadata'
);

select throws_ok(
  $$delete from public.profiles where id = tests.user_id('alice')$$,
  '42501',
  null,
  'authenticated clients cannot delete profiles directly'
);

select is(
  tests.affected_rows(
    $$delete from public.workspaces where id = tests.workspace_id('alpha')$$
  ),
  0,
  'Charlie cannot delete Alpha'
);

select is(
  tests.affected_rows(
    $$delete from public.workspace_members
      where workspace_id = tests.workspace_id('alpha') and user_id = tests.user_id('bob')$$
  ),
  0,
  'Charlie cannot delete Alpha memberships'
);

select is(
  tests.affected_rows(
    $$delete from public.tasks where id = '00000000-0000-4000-8000-000000000501'$$
  ),
  0,
  'Charlie cannot delete Alpha tasks'
);

select is(
  tests.affected_rows(
    $$delete from public.comments where id = '00000000-0000-4000-8000-000000000502'$$
  ),
  0,
  'Charlie cannot delete Alpha comments'
);

select throws_ok(
  $$delete from public.activity_logs where workspace_id = tests.workspace_id('alpha')$$,
  '42501',
  null,
  'authenticated clients cannot delete activity logs directly'
);

select is(
  tests.affected_rows(
    $$delete from public.attachments where id = '00000000-0000-4000-8000-000000000503'$$
  ),
  0,
  'Charlie cannot delete Alpha attachment metadata'
);

select * from finish();
rollback;
