-- =============================================================================
-- Hardening de RLS: cerrar el acceso público de facto vía anon key.
-- =============================================================================
-- Este script se aplica SOLO. No crea ni consulta objetos de la integración
-- con Mapa del Delito (no usa api_victimas_publicas, ni roles JWT, ni las
-- tablas de candidatos). No hay que correr 015 ni ningún script posterior.
--
-- Problema:
--
--   Las policies de `public.*` creadas en 001_create_tables.sql (y las
--   agregadas después, ej. 007) son `FOR ALL USING (true)` SIN cláusula
--   `TO <rol>`. En Postgres eso significa "aplica a cualquier rol", incluido
--   `anon`. La app siempre opera autenticada (el middleware redirige a
--   /login si no hay sesión), pero la API REST de PostgREST es independiente
--   del middleware de Next.js: cualquiera con la `anon key` (embebida en el
--   bundle público del frontend) puede hacer SELECT/INSERT/UPDATE/DELETE
--   directo contra `victimas`, `hechos`, `seguimiento`, etc. sin login.
--
-- Qué hace:
--   1. Quita a `anon` de los privilegios por defecto de tablas, secuencias
--      y funciones que se creen después en `public` (solo para el rol que
--      ejecuta este script, normalmente `postgres` en el SQL Editor).
--   2. Crea `is_allowed_user()`: función SECURITY DEFINER que chequea el
--      email de la sesión contra `allowed_users`. La comparación es exacta
--      (`email = auth.email()`): minúsculas y sin espacios, igual que el
--      email del JWT. Ver docs/APLICAR-014.md antes de correr esto.
--   3. Reemplaza las policies `FOR ALL USING (true)` (sin TO) por
--      `FOR ALL TO authenticated USING (is_allowed_user())
--       WITH CHECK (is_allowed_user())` en las tablas curadas.
--   4. Restringe `allowed_users` a que cada usuario autenticado sólo pueda
--      leer SU PROPIA fila — compatible sin cambios de código con
--      `lib/supabase/middleware.ts` (consulta por su propio email) y con
--      las policies de storage en 010 (`auth.email() IN (SELECT email FROM
--      allowed_users)` sigue devolviendo esa fila).
--   5. Revoca los GRANT ya existentes de `anon` sobre las tablas y
--      secuencias de `public`. Si existe `get_dashboard_stats()` (script
--      011), le saca EXECUTE a `anon` y a PUBLIC — el GRANT explícito a
--      `anon` no alcanza, porque Postgres también le deja EXECUTE a PUBLIC
--      y por ahí la anon key sigue llamando la RPC. Si 011 no se aplicó,
--      este script igual termina.
--
-- Qué NO toca:
--   - Storage (010_secure_storage.sql).
--   - El cron `alerta-aniversarios` ni la edge function `check-anniversaries`.
--     Esa función lee con `SUPABASE_SERVICE_ROLE_KEY`, que ignora RLS.
--   - Ningún objeto de la integración con Mapa del Delito.
--
-- Requisitos que ya están en el proyecto Supabase (no los crea este script):
--   roles `anon` y `authenticated`, `auth.email()`, y las tablas
--   `victimas`, `hechos`, `imputados`, `fechas_juicio`, `seguimiento`,
--   `recursos`, `casos`, `instancias_judiciales`, `allowed_users`.
--
-- Ejecutar UNA vez en el SQL Editor de Supabase, después del respaldo
-- descrito en docs/APLICAR-014.md. Idempotente.
-- -----------------------------------------------------------------------------

-- 1. Privilegios por defecto. Tiene que ir antes de crear objetos en este
--    mismo script: ALTER DEFAULT PRIVILEGES no reescribe grants ya dados.
--    Sin FOR ROLE, sólo cambia los defaults del rol que ejecuta la sentencia.
--    Postgres igual otorga EXECUTE a PUBLIC en funciones nuevas; eso no se
--    toca acá. `is_allowed_user` se cierra abajo con REVOKE FROM public.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- 2. Función de chequeo de whitelist (SECURITY DEFINER: ignora RLS de
--    allowed_users al evaluar, así funciona sin importar cómo quede su
--    propia policy). El owner de la función tiene que poder leer la tabla
--    (en Supabase, el rol del SQL Editor es owner y no tiene FORCE RLS).
create or replace function public.is_allowed_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.allowed_users
    where email = auth.email()
  );
$$;

revoke all on function public.is_allowed_user() from public;
revoke all on function public.is_allowed_user() from anon;
grant execute on function public.is_allowed_user() to authenticated;

-- 3. Recrear policies de las tablas curadas con TO authenticated +
--    chequeo de whitelist real (no sólo "estar logueado").
do $$
declare
  t text;
  tables text[] := array[
    'victimas', 'hechos', 'imputados', 'fechas_juicio', 'seguimiento',
    'recursos', 'casos', 'instancias_judiciales'
  ];
  pol record;
begin
  foreach t in array tables loop
    -- Borrar TODAS las policies existentes de la tabla, sea cual sea su
    -- nombre (evita depender de los nombres exactos usados en scripts
    -- previos, que variaron entre "Allow all operations on X" y otros).
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;

    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user())',
      t || '_whitelist_all', t
    );

    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- 4. allowed_users: cada usuario autenticado ve sólo su propia fila.
alter table public.allowed_users enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'allowed_users'
  loop
    execute format('drop policy if exists %I on public.allowed_users', pol.policyname);
  end loop;
end $$;

create policy "allowed_users_select_own" on public.allowed_users
  for select to authenticated
  using (email = auth.email());

-- Sin INSERT/UPDATE/DELETE para authenticated: la whitelist se administra
-- a mano desde el SQL Editor (rol que ignora RLS).

-- 5. Revocar grants ya existentes de `anon`. ALTER DEFAULT PRIVILEGES no
--    los toca. `get_dashboard_stats` viene de 011; si no está, se omite.
--    El EXECUTE de PUBLIC (`=X` en proacl) también hay que sacarlo: si no,
--    `anon` sigue pudiendo llamar la RPC aunque se le haya revocado el
--    grant directo. El GRANT a `authenticated` se repite para que quede
--    explícito después de ese REVOKE.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

do $$
begin
  if to_regprocedure('public.get_dashboard_stats()') is not null then
    revoke all on function public.get_dashboard_stats() from public;
    revoke all on function public.get_dashboard_stats() from anon;
    grant execute on function public.get_dashboard_stats() to authenticated;
  end if;
end $$;

-- Verificación esperada (detalle operativo en docs/APLICAR-014.md):
--
--   select schemaname, tablename, policyname, roles
--   from pg_policies where schemaname = 'public';
--   -> roles = {authenticated} en todas. Nunca {public} ni anon.
--
--   select table_name, privilege_type
--   from information_schema.table_privileges
--   where table_schema = 'public' and grantee = 'anon';
--   -> cero filas.
--
--   Un curl con sólo la anon key, sin sesión, debe devolver [] o 401/403,
--   nunca objetos:
--     curl "https://<proyecto>.supabase.co/rest/v1/victimas?select=id&limit=1" \
--          -H "apikey: <anon-key>" \
--          -H "Authorization: Bearer <anon-key>"
