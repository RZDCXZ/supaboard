insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.profiles
add constraint profiles_avatar_path_owned
check (
  avatar_path is null
  or avatar_path ~ (
    '^' || id::text || '/avatar\.(jpg|jpeg|png|webp)$'
  )
);

create policy "Avatar owners can select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and cardinality(storage.foldername(name)) = 1
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.filename(name) = any (
    array['avatar.jpg', 'avatar.jpeg', 'avatar.png', 'avatar.webp']
  )
);

create policy "Avatar owners can insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and cardinality(storage.foldername(name)) = 1
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.filename(name) = any (
    array['avatar.jpg', 'avatar.jpeg', 'avatar.png', 'avatar.webp']
  )
);

create policy "Avatar owners can update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and cardinality(storage.foldername(name)) = 1
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.filename(name) = any (
    array['avatar.jpg', 'avatar.jpeg', 'avatar.png', 'avatar.webp']
  )
)
with check (
  bucket_id = 'avatars'
  and cardinality(storage.foldername(name)) = 1
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.filename(name) = any (
    array['avatar.jpg', 'avatar.jpeg', 'avatar.png', 'avatar.webp']
  )
);

create policy "Avatar owners can delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and cardinality(storage.foldername(name)) = 1
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.filename(name) = any (
    array['avatar.jpg', 'avatar.jpeg', 'avatar.png', 'avatar.webp']
  )
);
