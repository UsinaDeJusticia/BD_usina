-- =============================================================================
-- 013b: RLS por usuario autorizado y bucket de archivos
-- =============================================================================
-- Paso 3 de 3 del cambio de RLS. Requiere 013a ejecutado y el código nuevo ya
-- desplegado (ver el orden en 013a). Ejecutarlo antes deja fuera al personal.
--
-- Reemplaza las políticas "Allow all operations ... USING (true)" de las tablas
-- con datos personales. Antes de este script, anon podía leer, escribir y borrar
-- todas las filas con la clave pública del proyecto.
--
-- Modelo después de este script:
--   * anon no tiene ningún privilegio sobre las tablas de la app ni sobre el
--     bucket de archivos.
--   * authenticated accede sólo si public.is_allowed_user() es true (ver 013a).
--   * allowed_users no es legible ni escribible desde el navegador.
--   * Las políticas usan (select public.is_allowed_user()) para que Postgres la
--     evalúe una sola vez por sentencia.
--
-- Configuración de Supabase Auth que este script SUPONE y que hay que verificar
-- en el panel (no se puede comprobar desde SQL). Si alguna falla, cualquiera
-- puede obtener acceso a los datos:
--   * Authentication > Providers > Email > "Confirm email": ACTIVADO.
--   * Authentication > Providers > Email > "Secure email change": ACTIVADO.
--   * Authentication > Sign In / Providers > "Allow new users to sign up":
--     DESACTIVADO (sólo invitación o alta manual), o al menos sin autoconfirmación.
--   * Autoconfirmación de usuarios (auto-confirm): DESACTIVADA.
--   * Proveedores: sólo los que se usan (hoy password y Google).
-- Sin confirmación de email, GoTrue entrega un usuario con email_confirmed_at ya
-- cargado; alguien podría registrar la dirección de una persona autorizada que
-- todavía no tiene cuenta.
--
-- Ejecutar UNA vez en SQL Editor del proyecto Supabase, después de 013a y del
-- despliegue. Ver la consulta de verificación al final.
-- -----------------------------------------------------------------------------

-- 1. Quitar todas las políticas existentes y cerrar anon ----------------------
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

-- 2. Políticas para usuarios autorizados (tablas de la app) -------------------
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

-- 3. allowed_users: sólo para el servidor y el SQL Editor ---------------------
-- Sin políticas y sin privilegios para anon ni authenticated. Las altas y bajas
-- se hacen desde el SQL Editor (rol postgres) o con service role.
revoke all on public.allowed_users from authenticated;

-- 4. Bucket de archivos -------------------------------------------------------
-- El bucket archivos-casos es privado. Se eliminan TODAS las políticas de
-- storage.objects (incluidas las que dejó scripts/003 con nombres en inglés) y
-- se crean sólo las del bucket, para usuarios autorizados. La app usa sólo ese
-- bucket (lib/supabase/storage.ts, app/api/files).
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
--   -- Usuarios autorizados sin email confirmado o sin cuenta (quedarían fuera):
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
