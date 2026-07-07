begin;

select plan(11);

select has_table('public', 'profiles', 'profiles table exists');

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
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Owner Name"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'member@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

select is(
  (
    select count(*)::integer
    from public.profiles
    where id in (
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002'
    )
  ),
  2,
  'a profile is created for every auth user'
);

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000001'),
  'Owner Name',
  'profile prefers the provider display name'
);

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000002'),
  'member',
  'profile falls back to the email local part'
);

set local role anon;

select throws_ok(
  $$select * from public.profiles$$,
  '42501',
  null,
  'anonymous users have no table access'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.profiles
    where id in (
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002'
    )
  ),
  2,
  'authenticated users can read profiles'
);

select lives_ok(
  $$update public.profiles
    set display_name = 'Changed Owner'
    where id = '00000000-0000-0000-0000-000000000001'$$,
  'users can update their own profile'
);

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000001'),
  'Changed Owner',
  'the owner update is persisted'
);

select lives_ok(
  $$update public.profiles
    set display_name = 'Changed Member'
    where id = '00000000-0000-0000-0000-000000000002'$$,
  'an update targeting another profile does not leak an authorization error'
);

select throws_ok(
  $$update public.profiles set display_name = '   ' where id = '00000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'blank display names are rejected'
);

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000002'),
  'member',
  'another profile remains unchanged'
);

select * from finish();
rollback;
