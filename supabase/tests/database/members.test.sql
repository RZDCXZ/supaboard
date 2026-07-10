begin;

\ir ./_helpers.psql

select plan(9);

select hasnt_column(
  'public',
  'profiles',
  'email',
  'public profiles do not expose auth email addresses'
);

select is(
  (
    select count(*)::integer
    from auth.users
    where id in (
      tests.user_id('alice'),
      tests.user_id('bob'),
      tests.user_id('charlie')
    )
  ),
  3,
  'the seed provides Alice, Bob, and Charlie auth users'
);

select is(
  (
    select count(*)::integer
    from auth.identities
    where user_id in (
      tests.user_id('alice'),
      tests.user_id('bob'),
      tests.user_id('charlie')
    )
      and provider = 'email'
      and provider_id = user_id::text
  ),
  3,
  'every seeded user has an email identity'
);

select results_eq(
  $$select workspace_id, user_id, role
    from public.workspace_members
    where workspace_id in (tests.workspace_id('alpha'), tests.workspace_id('beta'))
    order by workspace_id, (role = 'owner') desc, user_id$$,
  $$values
    (tests.workspace_id('alpha'), tests.user_id('alice'), 'owner'::text),
    (tests.workspace_id('alpha'), tests.user_id('bob'), 'member'::text),
    (tests.workspace_id('beta'), tests.user_id('charlie'), 'owner'::text)$$,
  'the seed provides two deterministic workspaces and memberships'
);

select tests.authenticate_as('alice');
set local role authenticated;

select results_eq(
  $$select user_id, role
    from public.workspace_members
    where workspace_id = tests.workspace_id('alpha')
    order by (role = 'owner') desc, joined_at, user_id$$,
  $$values
    (tests.user_id('alice'), 'owner'::text),
    (tests.user_id('bob'), 'member'::text)$$,
  'Alice can read the Alpha member list with the owner first'
);

reset role;
select tests.authenticate_as('bob');
set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.workspace_members
    where workspace_id = tests.workspace_id('alpha')
  ),
  2,
  'Bob can read both Alpha members'
);

select is(
  (
    select count(*)::integer
    from public.workspace_members
    where workspace_id = tests.workspace_id('beta')
  ),
  0,
  'Bob cannot read Beta memberships'
);

reset role;
select tests.authenticate_as('charlie');
set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.workspace_members
    where workspace_id = tests.workspace_id('alpha')
  ),
  0,
  'Charlie cannot read Alpha memberships by guessing the workspace id'
);

select results_eq(
  $$select user_id, role
    from public.workspace_members
    where workspace_id = tests.workspace_id('beta')$$,
  $$values (tests.user_id('charlie'), 'owner'::text)$$,
  'Charlie can read the Beta owner membership'
);

reset role;

select * from finish();
rollback;
