-- Local-only demo identities. Never reuse these credentials in a hosted project.
begin;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000011',
    'authenticated',
    'authenticated',
    'alice@example.com',
    crypt('SupaBoard123!', gen_salt('bf')),
    '2026-07-10 00:00:00+00',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Alice"}'::jsonb,
    '2026-07-10 00:00:00+00',
    '2026-07-10 00:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000012',
    'authenticated',
    'authenticated',
    'bob@example.com',
    crypt('SupaBoard123!', gen_salt('bf')),
    '2026-07-10 00:00:00+00',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Bob"}'::jsonb,
    '2026-07-10 00:00:00+00',
    '2026-07-10 00:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000013',
    'authenticated',
    'authenticated',
    'charlie@example.com',
    crypt('SupaBoard123!', gen_salt('bf')),
    '2026-07-10 00:00:00+00',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Charlie"}'::jsonb,
    '2026-07-10 00:00:00+00',
    '2026-07-10 00:00:00+00'
  )
on conflict do nothing;

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000011',
    '{"sub":"00000000-0000-4000-8000-000000000011","email":"alice@example.com","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    '2026-07-10 00:00:00+00',
    '2026-07-10 00:00:00+00',
    '2026-07-10 00:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000012',
    '{"sub":"00000000-0000-4000-8000-000000000012","email":"bob@example.com","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    '2026-07-10 00:00:00+00',
    '2026-07-10 00:00:00+00',
    '2026-07-10 00:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000000013',
    '00000000-0000-4000-8000-000000000013',
    '00000000-0000-4000-8000-000000000013',
    '{"sub":"00000000-0000-4000-8000-000000000013","email":"charlie@example.com","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    '2026-07-10 00:00:00+00',
    '2026-07-10 00:00:00+00',
    '2026-07-10 00:00:00+00'
  )
on conflict do nothing;

insert into public.workspaces (id, name, owner_id, created_at, updated_at)
values
  (
    '00000000-0000-4000-8000-000000000101',
    'Alpha',
    '00000000-0000-4000-8000-000000000011',
    '2026-07-10 00:00:00+00',
    '2026-07-10 00:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    'Beta',
    '00000000-0000-4000-8000-000000000013',
    '2026-07-10 00:00:00+00',
    '2026-07-10 00:00:00+00'
  )
on conflict do nothing;

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  added_by,
  joined_at
)
values
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000011',
    'owner',
    null,
    '2026-07-10 00:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000012',
    'member',
    '00000000-0000-4000-8000-000000000011',
    '2026-07-10 00:01:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000013',
    'owner',
    null,
    '2026-07-10 00:00:00+00'
  )
on conflict do nothing;

commit;
