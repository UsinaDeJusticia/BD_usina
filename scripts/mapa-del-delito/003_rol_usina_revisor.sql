-- =============================================================================
-- Rol `rol_usina_revisor` — a correr en el proyecto Supabase de
-- MAPA DEL DELITO (NO en el de BD Usina).
-- =============================================================================
-- Espejo de `rol_mdd_lector` (ver scripts/016_rol_mdd_lector.sql del repo
-- BD Usina). Permisos mínimos para que BD Usina pueda:
--   1. Leer la cola de pendientes (`api_propuestas_publicas`).
--   2. Actualizar SOLO las columnas de decisión de una propuesta puntual
--      (`estado`, `usina_victima_id`, `motivo_rechazo`, `decidido_at`,
--      `decidido_por`) — nunca el resto de la fila, nunca INSERT/DELETE.
--
-- Ejecutar UNA vez en el SQL Editor de Supabase. Idempotente.
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'rol_usina_revisor') then
    create role rol_usina_revisor nologin;
  end if;
end $$;

grant rol_usina_revisor to authenticator;
grant usage on schema public to rol_usina_revisor;

-- 1. Lectura de la cola de pendientes, vía la vista.
grant select on public.api_propuestas_publicas to rol_usina_revisor;

-- 2. Escritura acotada contra la tabla base (no la vista — ver nota en
--    002_api_propuestas_publicas.sql sobre por qué no se usa la vista
--    para el UPDATE).
--
--    `id` con SELECT explícito: Postgres exige privilegio SELECT sobre
--    cualquier columna referenciada en la cláusula WHERE de un UPDATE,
--    incluida la que identifica la fila (`id=eq.<uuid>` en el PATCH de
--    PostgREST). Se pide con `Prefer: return=minimal` en la request para
--    no necesitar además poder leer el resto de columnas al devolver el
--    resultado (ver lib/mdd/client.ts en el repo de BD Usina).
grant select (id) on public.propuestas_para_usina to rol_usina_revisor;

grant update (estado, usina_victima_id, motivo_rechazo, decidido_at, decidido_por)
  on public.propuestas_para_usina to rol_usina_revisor;

drop policy if exists "usina_revisor_update" on public.propuestas_para_usina;
create policy "usina_revisor_update" on public.propuestas_para_usina
  for update to rol_usina_revisor
  using (true)
  with check (true);

-- Defensivo: sin acceso a ninguna otra tabla del schema.
-- (Ajustar la lista si el schema de MdD tiene más tablas que deban
-- quedar explícitamente fuera del alcance de este rol.)

-- =============================================================================
-- Generar el JWT que usará BD Usina
-- =============================================================================
-- Mismo mecanismo que scripts/016_rol_mdd_lector.sql del lado BD Usina,
-- pero firmado con el JWT Secret del proyecto de MdD.
--
--   node -e '
--     const jwt = require("jsonwebtoken");
--     const secret = process.env.SUPABASE_JWT_SECRET; // el de MdD
--     const token = jwt.sign(
--       { role: "rol_usina_revisor", iss: "supabase" },
--       secret,
--       { expiresIn: "365d" }
--     );
--     console.log(token);
--   '
--
-- El token resultante es el valor de `MDD_SUPABASE_JWT` en las env vars
-- de Vercel del proyecto BD Usina (ver lib/mdd/client.ts).
--
-- Verificación:
--   curl -s "https://<proyecto-mdd>.supabase.co/rest/v1/api_propuestas_publicas?select=*&limit=1" \
--        -H "apikey: <token>" -H "Authorization: Bearer <token>" | jq .
--
--   curl -s -X PATCH "https://<proyecto-mdd>.supabase.co/rest/v1/propuestas_para_usina?id=eq.<uuid-de-prueba>" \
--        -H "apikey: <token>" -H "Authorization: Bearer <token>" \
--        -H "Content-Type: application/json" -H "Prefer: return=minimal" \
--        -d '{"estado":"rechazada","motivo_rechazo":"prueba"}'
--   -- 204 No Content = OK. Intentar actualizar `nombre_completo` en la
--   -- misma request debe fallar (columna sin GRANT).
