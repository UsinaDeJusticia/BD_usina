-- Bucket privado de archivos de casos y sus políticas (whitelist).
--
-- En producción esto ya existe (scripts/010_secure_storage.sql y
-- 015_data_integrity.sql): esta migración queda registrada como aplicada con
-- `supabase migration repair` y sólo corre en bases nuevas (local, CI).
-- `supabase db dump` no incluye el esquema storage porque lo administra
-- Supabase; por eso va aparte.
--
-- Idempotente: se puede correr más de una vez.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'archivos-casos',
  'archivos-casos',
  false,
  52428800, -- 50 MB
  array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'image/heic', 'image/heif', 'image/avif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4', 'audio/mpeg'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "archivos_casos_select_whitelist" on storage.objects;
drop policy if exists "archivos_casos_insert_whitelist" on storage.objects;
drop policy if exists "archivos_casos_update_whitelist" on storage.objects;
drop policy if exists "archivos_casos_delete_whitelist" on storage.objects;

create policy "archivos_casos_select_whitelist" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'archivos-casos'
    and (select auth.email()) in (select email from public.allowed_users)
  );

create policy "archivos_casos_insert_whitelist" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'archivos-casos'
    and (select auth.email()) in (select email from public.allowed_users)
  );

create policy "archivos_casos_update_whitelist" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'archivos-casos'
    and (select auth.email()) in (select email from public.allowed_users)
  )
  with check (
    bucket_id = 'archivos-casos'
    and (select auth.email()) in (select email from public.allowed_users)
  );

create policy "archivos_casos_delete_whitelist" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'archivos-casos'
    and (select auth.email()) in (select email from public.allowed_users)
  );
