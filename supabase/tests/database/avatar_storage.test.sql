begin;

\ir ./_helpers.psql

select plan(18);

select is(
  (select public from storage.buckets where id = 'avatars'),
  true,
  'avatars is a public bucket'
);

select is(
  (select file_size_limit from storage.buckets where id = 'avatars'),
  2097152::bigint,
  'avatars limits files to 2 MB'
);

select results_eq(
  $$select unnest(allowed_mime_types) from storage.buckets where id = 'avatars' order by 1$$,
  $$values ('image/jpeg'::text), ('image/png'::text), ('image/webp'::text)$$,
  'avatars accepts only JPEG, PNG, and WebP'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'Avatar owners can %'
  ),
  4,
  'avatars has separate select, insert, update, and delete policies'
);

insert into storage.objects (bucket_id, name, owner_id)
values (
  'avatars',
  tests.user_id('bob')::text || '/avatar.png',
  tests.user_id('bob')::text
);

select tests.authenticate_as('alice');
set local role authenticated;

select lives_ok(
  format(
    'insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)',
    'avatars',
    tests.user_id('alice')::text || '/avatar.jpg',
    tests.user_id('alice')::text
  ),
  'Alice can insert her avatar metadata'
);

select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'avatars'
      and name = tests.user_id('alice')::text || '/avatar.jpg'
  ),
  1,
  'Alice can select her avatar metadata for upsert'
);

select lives_ok(
  format(
    'update storage.objects set metadata = %L::jsonb where bucket_id = %L and name = %L',
    '{"stage":10}',
    'avatars',
    tests.user_id('alice')::text || '/avatar.jpg'
  ),
  'Alice can update her avatar metadata for upsert'
);

select throws_ok(
  format(
    'insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)',
    'avatars',
    tests.user_id('bob')::text || '/avatar.jpg',
    tests.user_id('alice')::text
  ),
  '42501',
  null,
  'Alice cannot insert into Bob avatar path'
);

select throws_ok(
  format(
    'insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)',
    'avatars',
    tests.user_id('alice')::text || '/nested/avatar.png',
    tests.user_id('alice')::text
  ),
  '42501',
  null,
  'Alice cannot insert a nested avatar path'
);

select throws_ok(
  format(
    'insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)',
    'avatars',
    tests.user_id('alice')::text || '/cover.png',
    tests.user_id('alice')::text
  ),
  '42501',
  null,
  'Alice cannot insert an arbitrary filename'
);

select throws_ok(
  format(
    'insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, %L)',
    'avatars',
    tests.user_id('alice')::text || '/avatar.gif',
    tests.user_id('alice')::text
  ),
  '42501',
  null,
  'Alice cannot insert an unsupported extension'
);

select lives_ok(
  format(
    'update storage.objects set metadata = %L::jsonb where bucket_id = %L and name = %L',
    '{"attacker":true}',
    'avatars',
    tests.user_id('bob')::text || '/avatar.png'
  ),
  'cross-user update does not reveal object existence'
);

select isnt(
  (
    select metadata ->> 'attacker'
    from storage.objects
    where bucket_id = 'avatars'
      and name = tests.user_id('bob')::text || '/avatar.png'
  ),
  'true',
  'Alice cannot update Bob avatar metadata'
);

reset role;

select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'avatars'
      and name = tests.user_id('bob')::text || '/avatar.png'
  ),
  1,
  'Alice cannot delete Bob avatar metadata'
);

select tests.authenticate_as('alice');
set local role authenticated;

select lives_ok(
  $$update public.profiles
    set avatar_path = tests.user_id('alice')::text || '/avatar.webp'
    where id = tests.user_id('alice')$$,
  'Alice can save her own valid avatar path'
);

select throws_ok(
  $$update public.profiles
    set avatar_path = tests.user_id('bob')::text || '/avatar.webp'
    where id = tests.user_id('alice')$$,
  '23514',
  null,
  'profile rejects another user avatar path'
);

select throws_ok(
  $$update public.profiles
    set avatar_path = 'https://example.com/avatar.png'
    where id = tests.user_id('alice')$$,
  '23514',
  null,
  'profile rejects arbitrary avatar URLs'
);

reset role;
select tests.clear_authentication();
set local role anon;

select throws_ok(
  format(
    'insert into storage.objects (bucket_id, name) values (%L, %L)',
    'avatars',
    tests.user_id('alice')::text || '/avatar.png'
  ),
  '42501',
  null,
  'anonymous users cannot upload avatars'
);

reset role;

select * from finish();
rollback;
