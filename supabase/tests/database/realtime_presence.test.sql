begin;

\ir ./_helpers.psql

select plan(6);

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
  'workspace realtime read policy targets authenticated users'
);

select ok(
  (
    select qual ~ 'broadcast'
      and qual ~ 'presence'
      and qual ~ 'is_workspace_topic_member'
    from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'Workspace members can receive delete broadcasts'
  ),
  'workspace realtime read policy allows broadcast and presence for members'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'Workspace members can send workspace realtime'
      and cmd = 'INSERT'
      and roles = array['authenticated'::name]
  ),
  1,
  'workspace realtime write policy targets authenticated users'
);

select ok(
  (
    select with_check ~ 'presence'
      and with_check ~ 'broadcast'
      and with_check ~ 'is_workspace_topic_member'
    from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'Workspace members can send workspace realtime'
  ),
  'workspace realtime write policy permits presence and broadcast extensions for members'
);

select tests.authenticate_as('bob');

select ok(
  private.is_workspace_topic_member(
    'workspace:00000000-0000-4000-8000-000000000101'
  ),
  'Bob can authorize the seeded Alpha workspace topic'
);

select tests.authenticate_as('charlie');

select ok(
  not private.is_workspace_topic_member(
    'workspace:00000000-0000-4000-8000-000000000101'
  ),
  'Charlie cannot authorize the seeded Alpha workspace topic'
);

select * from finish();

rollback;
