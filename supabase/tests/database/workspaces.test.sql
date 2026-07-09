begin;

select plan(24);

select has_table('public', 'workspaces', 'workspaces table exists');
select has_table('public', 'workspace_members', 'workspace_members table exists');

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'alice@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Alice"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'bob@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Bob"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'charlie@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Charlie"}'::jsonb,
    now(),
    now()
  );

create temporary table test_workspace_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update, delete on table test_workspace_ids to authenticated;

set local role anon;

select throws_ok(
  $$select * from public.workspaces$$,
  '42501',
  null,
  'anonymous users have no workspaces table access'
);

select throws_ok(
  $$select * from public.workspace_members$$,
  '42501',
  null,
  'anonymous users have no workspace_members table access'
);

select throws_ok(
  $$select public.create_workspace('Nope')$$,
  '42501',
  null,
  'anonymous users cannot execute create_workspace'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$insert into test_workspace_ids (key, id)
    values ('alpha', public.create_workspace('  Alpha  '))$$,
  'Alice can create a workspace through the RPC'
);

reset role;

select is(
  (select name from public.workspaces where id = (select id from test_workspace_ids where key = 'alpha')),
  'Alpha',
  'create_workspace trims and stores the workspace name'
);

select is(
  (
    select count(*)::integer
    from public.workspace_members
    where workspace_id = (select id from test_workspace_ids where key = 'alpha')
      and user_id = '00000000-0000-0000-0000-000000000011'
      and role = 'owner'
  ),
  1,
  'the creating user becomes the owner member'
);

select is(
  (
    select count(*)::integer
    from public.workspace_members
    where workspace_id = (select id from test_workspace_ids where key = 'alpha')
      and role = 'owner'
  ),
  1,
  'a workspace has exactly one owner member'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*)::integer from public.workspaces),
  1,
  'Alice can see her workspace'
);

select lives_ok(
  $$insert into public.workspace_members (workspace_id, user_id, role, added_by)
    values (
      (select id from test_workspace_ids where key = 'alpha'),
      '00000000-0000-0000-0000-000000000012',
      'member',
      '00000000-0000-0000-0000-000000000011'
    )$$,
  'the workspace owner can add a normal member'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*)::integer from public.workspaces),
  1,
  'Bob can see a workspace after joining it'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000013', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.workspaces
    where id = (select id from test_workspace_ids where key = 'alpha')
  ),
  0,
  'Charlie cannot read a workspace by guessing its UUID'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$update public.workspaces
    set name = 'Bob Edit'
    where id = (select id from test_workspace_ids where key = 'alpha')$$,
  'a non-owner workspace update does not leak an authorization error'
);

reset role;

select is(
  (select name from public.workspaces where id = (select id from test_workspace_ids where key = 'alpha')),
  'Alpha',
  'Bob cannot change Alice workspace'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$insert into public.workspace_members (workspace_id, user_id, role, added_by)
    values (
      (select id from test_workspace_ids where key = 'alpha'),
      '00000000-0000-0000-0000-000000000013',
      'member',
      '00000000-0000-0000-0000-000000000012'
    )$$,
  '42501',
  null,
  'Bob cannot add workspace members'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$update public.workspace_members
    set role = 'member'
    where workspace_id = (select id from test_workspace_ids where key = 'alpha')
      and user_id = '00000000-0000-0000-0000-000000000011'$$,
  'P0001',
  null,
  'the owner member record cannot be demoted'
);

select throws_ok(
  $$delete from public.workspace_members
    where workspace_id = (select id from test_workspace_ids where key = 'alpha')
      and user_id = '00000000-0000-0000-0000-000000000011'$$,
  'P0001',
  null,
  'the owner member record cannot be deleted directly'
);

reset role;

select throws_ok(
  $$insert into public.workspace_members (workspace_id, user_id, role)
    values (
      (select id from test_workspace_ids where key = 'alpha'),
      '00000000-0000-0000-0000-000000000012',
      'owner'
    )$$,
  '23505',
  null,
  'the partial unique index rejects a second owner'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$select public.create_workspace('   ')$$,
  'P0001',
  null,
  'blank workspace names are rejected'
);

select lives_ok(
  $$delete from public.workspace_members
    where workspace_id = (select id from test_workspace_ids where key = 'alpha')
      and user_id = '00000000-0000-0000-0000-000000000012'$$,
  'the owner can remove a normal member'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.workspace_members
    where workspace_id = (select id from test_workspace_ids where key = 'alpha')
      and user_id = '00000000-0000-0000-0000-000000000012'
  ),
  0,
  'the normal member is removed'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$delete from public.workspaces
    where id = (select id from test_workspace_ids where key = 'alpha')$$,
  'the owner can delete the workspace and cascade owner membership'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.workspaces
    where id = (select id from test_workspace_ids where key = 'alpha')
  ),
  0,
  'the workspace delete is persisted'
);

select * from finish();
rollback;
