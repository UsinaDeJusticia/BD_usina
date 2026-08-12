-- =============================================================================
-- Hardening de RLS: cerrar el acceso público de facto vía anon key.
-- =============================================================================
-- Problema encontrado en la auditoría de integración con Mapa del Delito:
--
--   Todas las policies de `public.*` creadas en 001_create_tables.sql (y las
--   agregadas después, ej. 007) son `FOR ALL USING (true)` SIN cláusula
--   `TO <rol>`. En Postgres eso significa "aplica a cualquier rol", incluido
--   `anon`. La app siempre opera autenticada (el middleware redirige a
--   /login si no hay sesión), pero la API REST de PostgREST es independiente
--   del middleware de Next.js: cualquiera con la `anon key` (embebida en el
--   bundle público del frontend, extraíble por cualquier visitante) puede
--   hoy hacer SELECT/INSERT/UPDATE/DELETE directo contra `victimas`,
--   `hechos`, `seguimiento`, etc. sin pasar nunca por el login.
--
--   Esto es lo que hace que la vista sanitizada para Mapa del Delito
--   (`api_victimas_publicas`, ver 015) tenga sentido: hoy da lo mismo,
--   porque la tabla cruda ya es de acceso público. Este script cierra
--   ESE agujero primero.
--
-- Qué hace:
--   1. Crea `is_allowed_user()`: función SECURITY DEFINER que chequea el
--      email de la sesión contra `allowed_users`, sin depender de que el
--      caller tenga permiso de leer esa tabla directamente.
--   2. Reemplaza las policies `FOR ALL USING (true)` (sin TO) por
--      `FOR ALL TO authenticated USING (is_allowed_user())
--       WITH CHECK (is_allowed_user())` en todas las tablas curadas.
--   3. Restringe `allowed_users` a que cada usuario autenticado sólo pueda
--      leer SU PROPIA fila (no toda la whitelist) — compatible sin cambios
--      de código con `lib/supabase/middleware.ts` (que consulta por su
--      propio email) y con las policies de storage en 010 (que hacen
--      `auth.email() IN (SELECT email FROM allowed_users)`: con RLS de
--      "fila propia", ese IN sigue devolviendo el resultado correcto).
--   4. Revoca todo acceso de `anon` a las tablas de `public` y a la RPC
--      `get_dashboard_stats()` — la app jamás necesita leer sin sesión.
--
-- Qué NO rompe:
--   - El flujo de la app: siempre opera con sesión (`authenticated`), y
--     `is_allowed_user()` reproduce exactamente el chequeo que ya hacía el
--     middleware, ahora también a nivel de base de datos.
--   - La edge function `check-anniversaries`: usa `SUPABASE_SERVICE_ROLE_KEY`,
--     que ignora RLS por completo.
--   - Storage: ya estaba resuelto en 010_secure_storage.sql (bucket privado
--     + whitelist), no se toca acá.
--
-- Ejecutar UNA vez en el SQL Editor de Supabase (producción). Idempotente:
-- puede correrse de nuevo sin efectos adversos.
-- -----------------------------------------------------------------------------

-- 1. Función de chequeo de whitelist (SECURITY DEFINER: ignora RLS de
--    allowed_users al evaluar, así funciona sin importar cómo quede su
--    propia policy).
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
grant execute on function public.is_allowed_user() to authenticated;

-- 2. Recrear policies de las tablas curadas con TO authenticated +
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

-- 3. allowed_users: cada usuario autenticado ve sólo su propia fila.
--    (Ver nota arriba: los consumidores existentes -middleware y storage-
--    siguen funcionando igual porque cada uno consulta/filtra por el
--    propio email de la sesión.)
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
-- a mano desde el SQL Editor (rol admin/service_role, que ignora RLS).

-- 4. Revocar `anon` a nivel de schema. Belt-and-suspenders sobre el punto
--    2 (que ya sacó a anon de las policies): esto además bloquea cualquier
--    tabla que se cree a futuro y herede grants por defecto de anon, y
--    cierra la RPC del dashboard para quien no tenga sesión.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on function public.get_dashboard_stats() from anon;

-- Verificación esperada tras correr esto:
--
--   -- Ninguna policy debería quedar sin "TO":
--   select schemaname, tablename, policyname, roles
--   from pg_policies where schemaname = 'public';
--   -> roles debe ser {authenticated} en todas (nunca {public} ni con anon).
--
--   -- Un curl con sólo la anon key (sin Authorization de usuario) debe
--   -- devolver [] o 401/403, nunca datos:
--   --   curl "https://<proyecto>.supabase.co/rest/v1/victimas?select=*" \
--   --        -H "apikey: <anon-key>"
--
--   -- La app en producción sigue funcionando igual (login normal,
--   -- listados, guardado de fichas) porque siempre corre autenticada.
