-- =============================================================================
-- 013 — Endurecer RLS: sólo usuarios autenticados en la whitelist
-- =============================================================================
-- PROBLEMA
--   001_create_tables.sql y 007_*.sql crearon políticas `FOR ALL USING (true)`
--   en todas las tablas de casos. La anon key es pública (va en el bundle JS),
--   así que cualquiera con la URL del proyecto podía leer, modificar o borrar
--   datos de víctimas directo contra la API REST, sin pasar por el middleware.
--   Además, cualquiera puede registrarse con Google y quedar como rol
--   `authenticated`: no alcanza con exigir `authenticated`, hay que exigir
--   que el email esté en `allowed_users` (igual que hace el middleware y las
--   políticas de Storage de 010_secure_storage.sql).
--
-- QUÉ HACE
--   1. Guarda una copia de TODAS las políticas actuales de estas tablas en
--      `admin_backup.policies_013` (para auditoría y para el rollback).
--   2. Crea `public.is_allowed_user()`.
--   3. En victimas, hechos, imputados, fechas_juicio, seguimiento, recursos,
--      casos e instancias_judiciales: reemplaza las políticas por una sola
--      `<tabla>_whitelist_all` (authenticated + whitelist) y revoca `anon`.
--   4. `allowed_users`: cada usuario sólo puede leer SU fila (lo que necesita
--      el middleware) y nadie puede escribirla desde la API. Se administra
--      desde el dashboard de Supabase (rol postgres / service_role).
--   5. `get_dashboard_stats()`: ya no ejecutable por `anon`.
--
-- DATOS
--   No modifica ni borra ninguna fila. Sólo cambia permisos/políticas.
--   Todo corre en UNA transacción: si algo falla, no se aplica nada.
--
-- IMPACTO EN LA APP
--   Ninguno para usuarios autorizados. La app ya exige login + whitelist en
--   todas las páginas (middleware) y la edge function usa service_role, que
--   ignora RLS. Lo único que deja de funcionar es el acceso anónimo directo
--   a la API, que es justamente el agujero.
--
-- ANTES DE CORRER
--   Verificar que tu propio email esté en allowed_users:
--     select email from public.allowed_users;
--
-- ROLLBACK: scripts/013_harden_rls_rollback.sql
-- Probado contra Postgres 16 con un esquema equivalente (ver PR).
-- -----------------------------------------------------------------------------

begin;

-- 1. Backup de políticas existentes ------------------------------------------
create schema if not exists admin_backup;
revoke all on schema admin_backup from public;
do $$
begin
  -- El esquema no lo expone PostgREST; igual se cierran los permisos.
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema admin_backup from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema admin_backup from authenticated';
  end if;
end $$;

create table if not exists admin_backup.policies_013 (
  backed_up_at timestamptz not null default now(),
  schemaname   name,
  tablename    name,
  policyname   name,
  permissive   text,
  roles        name[],
  cmd          text,
  qual         text,
  with_check   text
);

insert into admin_backup.policies_013 (schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check)
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('victimas','hechos','imputados','fechas_juicio','seguimiento',
                    'recursos','casos','instancias_judiciales','allowed_users')
  -- Sólo en la primera ejecución: si se re-corre el script, el backup sigue
  -- conteniendo las políticas ORIGINALES (las que restaura el rollback).
  and not exists (select 1 from admin_backup.policies_013);

-- 2. Helper de whitelist ------------------------------------------------------
-- security definer: puede leer allowed_users aunque el caller no tenga
-- permiso sobre toda la tabla. search_path vacío para evitar hijacking.
create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.allowed_users au
    where lower(au.email) = lower(coalesce(auth.email(), ''))
  );
$$;

revoke all on function public.is_allowed_user() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.is_allowed_user() from anon';
  end if;
end $$;
grant execute on function public.is_allowed_user() to authenticated;

-- 3. Tablas de casos ----------------------------------------------------------
do $$
declare
  t   text;
  pol record;
begin
  foreach t in array array['victimas','hechos','imputados','fechas_juicio',
                           'seguimiento','recursos','casos','instancias_judiciales']
  loop
    if to_regclass(format('public.%I', t)) is null then
      raise notice '013: tabla public.% no existe, se omite', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;

    -- `(select ...)` hace que Postgres evalúe la función una vez por query
    -- y no una vez por fila.
    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select public.is_allowed_user()))
         with check ((select public.is_allowed_user()))',
      t || '_whitelist_all', t
    );

    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- 4. allowed_users ------------------------------------------------------------
alter table public.allowed_users enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'allowed_users'
  loop
    execute format('drop policy %I on public.allowed_users', pol.policyname);
  end loop;
end $$;

-- El middleware y /api/files consultan `allowed_users` con el token del
-- usuario para ver si SU email está. Con esta política cada uno ve sólo su
-- propia fila: no se puede enumerar al equipo ni auto-agregarse.
create policy allowed_users_select_self on public.allowed_users
  for select to authenticated
  using (lower(email) = lower(coalesce((select auth.email()), '')));

revoke all on public.allowed_users from anon;
revoke insert, update, delete, truncate on public.allowed_users from authenticated;
grant select on public.allowed_users to authenticated;

-- 5. RPC del dashboard --------------------------------------------------------
do $$
begin
  if to_regprocedure('public.get_dashboard_stats()') is not null then
    execute 'revoke execute on function public.get_dashboard_stats() from public';
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute 'revoke execute on function public.get_dashboard_stats() from anon';
    end if;
    execute 'grant execute on function public.get_dashboard_stats() to authenticated';
  end if;
end $$;

-- 6. Verificación dentro de la transacción -----------------------------------
do $$
declare
  n int;
begin
  select count(*) into n
  from pg_policies
  where schemaname = 'public'
    and tablename in ('victimas','hechos','imputados','fechas_juicio','seguimiento',
                      'recursos','casos','instancias_judiciales','allowed_users')
    and (qual = 'true' or with_check = 'true' or 'anon' = any(roles) or 'public' = any(roles));
  if n > 0 then
    raise exception '013: quedan % políticas abiertas; se revierte todo', n;
  end if;
end $$;

commit;

-- -----------------------------------------------------------------------------
-- Verificación posterior (sólo lectura):
--
--   select tablename, policyname, roles, cmd from pg_policies
--   where schemaname = 'public' order by tablename;
--
--   -- Otras tablas de public con RLS desactivada (revisarlas a mano):
--   select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
--
-- Prueba funcional: abrir la app logueado con un usuario de la whitelist,
-- ver listado, detalle, dashboard, crear/editar un caso de prueba.
-- -----------------------------------------------------------------------------
