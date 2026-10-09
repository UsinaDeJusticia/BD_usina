-- =============================================================================
-- 013a: función de decisión de acceso public.is_allowed_user()
-- =============================================================================
-- Paso 1 de 3 del cambio de RLS (ver 013b). Este script sólo CREA la función y
-- sus permisos. No cambia ninguna política ni privilegio de tabla, así que es
-- seguro ejecutarlo antes de desplegar el código nuevo.
--
-- Orden de despliegue (no alterarlo):
--   1. Ejecutar 013a en SQL Editor.
--   2. Desplegar el código nuevo (middleware y /api/files llaman a la RPC
--      is_allowed_user).
--   3. Verificar que el dashboard y la navegación funcionan para un usuario
--      autorizado.
--   4. Ejecutar 013b (cambia RLS y storage).
--
-- Ejecutar 013b antes del paso 2 deja fuera a todo el personal, porque el
-- código anterior consulta allowed_users, que 013b quita a authenticated.
--
-- La función considera autorizado a un usuario sólo si:
--   * su email está en allowed_users (comparación sin distinguir mayúsculas),
--   * su email está confirmado en auth.users,
--   * no está baneado (banned_until en el futuro o nulo).
-- -----------------------------------------------------------------------------

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
      and (u.banned_until is null or u.banned_until < now())
  )
$$;

revoke all on function public.is_allowed_user() from public, anon;
grant execute on function public.is_allowed_user() to authenticated;
