-- =============================================================================
-- RLS: reemplazo de las políticas "Allow all operations ... USING (true)"
-- =============================================================================
-- Problema: las tablas con datos personales (víctimas, hechos, imputados, casos,
-- seguimiento, recursos, fechas de juicio, instancias judiciales) tenían una
-- política FOR ALL USING (true) sin cláusula TO. Eso dejaba leer, escribir y
-- borrar todas las filas a cualquiera con la clave anon, que es pública por
-- diseño (NEXT_PUBLIC_SUPABASE_ANON_KEY). Además, la lista blanca (allowed_users)
-- sólo se aplicaba en el middleware de Next.js, no en las tablas.
--
-- Modelo después de este script:
--   * anon no tiene ningún privilegio sobre las tablas de la app ni sobre el
--     bucket de archivos.
--   * Un usuario autenticado accede sólo si public.is_allowed_user() es true:
--     su email está en allowed_users Y su email está confirmado en auth.users.
--   * allowed_users no es legible ni escribible desde el navegador. La decisión
--     se consulta con la función, que corre como SECURITY DEFINER.
--   * Las políticas usan (select public.is_allowed_user()) para que Postgres la
--     evalúe una sola vez por sentencia.
--
-- Requisitos antes de ejecutar:
--   1. scripts/012_dashboard_rpc_victimas.sql ya está ejecutado o se ejecuta
--      después (la RPC sigue funcionando con este RLS, pero es el orden esperado).
--   2. Los usuarios de allowed_users tienen email confirmado. Ver la consulta de
--      verificación al final: si algún usuario autorizado aparece sin
--      confirmar, quedará fuera hasta confirmar su email.
--   3. El middleware y la ruta /api/files consultan public.is_allowed_user() por
--      RPC (cambio de código incluido en este commit). Si se ejecuta este script
--      antes de desplegar ese código, los usuarios serán redirigidos a
--      /no-autorizado.
--
-- Ejecutar UNA vez en SQL Editor del proyecto Supabase.
-- -----------------------------------------------------------------------------

-- 1. Decisión de acceso única -------------------------------------------------
-- SECURITY DEFINER: lee auth.users y allowed_users sin depender de sus propias
-- políticas. search_path vacío para evitar secuestro por objetos homónimos.
create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.allowed_users au
      on lower(au.email) = lower(u.email)
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
  )
$$;

revoke all on function public.is_allowed_user() from public, anon;
grant execute on function public.is_allowed_user() to authenticated;

-- 2. Quitar todas las políticas existentes y cerrar anon ----------------------
-- Se eliminan TODAS las políticas de estas tablas, no sólo "Allow all", para
-- que no sobreviva ninguna permisiva creada a mano.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'victimas', 'hechos', 'imputados', 'fechas_juicio', 'seguimiento',
    'recursos', 'casos', 'instancias_judiciales', 'allowed_users'
  ]
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'public.% no existe, se omite', t;
      continue;
    end if;
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
      raise notice 'política eliminada: public.%.%', t, p.policyname;
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, public', t);
  end loop;
end $$;

-- 3. Políticas para usuarios autorizados (tablas de la app) -------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'victimas', 'hechos', 'imputados', 'fechas_juicio', 'seguimiento',
    'recursos', 'casos', 'instancias_judiciales'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.is_allowed_user()))',
      t || '_select_allowed', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.is_allowed_user()))',
      t || '_insert_allowed', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.is_allowed_user())) with check ((select public.is_allowed_user()))',
      t || '_update_allowed', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select public.is_allowed_user()))',
      t || '_delete_allowed', t);
  end loop;
end $$;

-- 4. allowed_users: sólo para el servidor y el SQL Editor ---------------------
-- Sin políticas y sin privilegios para anon ni authenticated. Las altas y bajas
-- se hacen desde el SQL Editor (rol postgres) o con service role.
revoke all on public.allowed_users from authenticated;

-- 5. Bucket de archivos -------------------------------------------------------
-- El bucket archivos-casos es privado. Se eliminan TODAS las políticas de
-- storage.objects (incluidas las que dejó scripts/003 con nombres en inglés) y
-- se crean sólo las del bucket, para usuarios autorizados.
update storage.buckets set public = false where id = 'archivos-casos';

do $$
declare
  p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
    raise notice 'política de storage eliminada: %', p.policyname;
  end loop;
end $$;

create policy archivos_casos_select_allowed on storage.objects
  for select to authenticated
  using (bucket_id = 'archivos-casos' and (select public.is_allowed_user()));

create policy archivos_casos_insert_allowed on storage.objects
  for insert to authenticated
  with check (bucket_id = 'archivos-casos' and (select public.is_allowed_user()));

create policy archivos_casos_update_allowed on storage.objects
  for update to authenticated
  using (bucket_id = 'archivos-casos' and (select public.is_allowed_user()))
  with check (bucket_id = 'archivos-casos' and (select public.is_allowed_user()));

create policy archivos_casos_delete_allowed on storage.objects
  for delete to authenticated
  using (bucket_id = 'archivos-casos' and (select public.is_allowed_user()));

-- Verificación (ejecutar con el rol postgres en SQL Editor):
--   -- Usuarios autorizados sin email confirmado (quedarían fuera):
--   select a.email, u.email_confirmed_at
--   from public.allowed_users a
--   left join auth.users u on lower(u.email) = lower(a.email)
--   where u.email_confirmed_at is null or u.id is null;
--
--   -- Ninguna política permisiva debe quedar:
--   select schemaname, tablename, policyname, roles, cmd, qual
--   from pg_policies
--   where schemaname in ('public', 'storage') and (qual = 'true' or with_check = 'true');
--
--   -- Privilegios de anon sobre tablas de la app (debe devolver 0 filas):
--   select table_name, privilege_type from information_schema.role_table_grants
--   where grantee = 'anon' and table_schema = 'public'
--     and table_name in ('victimas','hechos','imputados','fechas_juicio',
--       'seguimiento','recursos','casos','instancias_judiciales','allowed_users');
