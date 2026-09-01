-- =============================================================================
-- Rol dedicado para Mapa del Delito: rol_mdd_lector
-- =============================================================================
-- Las API keys del dashboard de Supabase (anon/service_role o las nuevas
-- publishable/secret) no se pueden ligar a un rol Postgres custom con
-- permisos acotados — son siempre `anon`, `authenticated` o `service_role`.
--
-- Para darle a Mapa del Delito acceso de SOLO LECTURA a
-- `api_victimas_publicas` (y a nada más), se crea un rol Postgres propio y
-- se autentica con un JWT firmado a mano (mismo mecanismo que usa
-- Supabase Auth internamente, con el `role` claim apuntando a este rol en
-- vez de a `authenticated`).
--
-- Ejecutar UNA vez en el SQL Editor de Supabase (producción). Idempotente.
-- -----------------------------------------------------------------------------

-- 1. Rol sin capacidad de login directo (PostgREST hace `SET LOCAL ROLE`,
--    nunca conecta como este rol vía password).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'rol_mdd_lector') then
    create role rol_mdd_lector nologin;
  end if;
end $$;

-- 2. El rol `authenticator` (con el que PostgREST abre la conexión) debe
--    poder asumir este rol vía SET ROLE.
grant rol_mdd_lector to authenticator;

-- 3. Único permiso: SELECT sobre la vista sanitizada. Nada de tablas base.
grant usage on schema public to rol_mdd_lector;
grant select on public.api_victimas_publicas to rol_mdd_lector;

-- Defensivo: confirmar que NO tiene acceso a nada más (no debería, porque
-- no se le otorgó, pero lo dejamos explícito por si alguna vez se le
-- grantea algo a `public` en general).
revoke all on public.victimas, public.hechos, public.imputados,
  public.fechas_juicio, public.seguimiento, public.recursos,
  public.casos, public.instancias_judiciales, public.allowed_users
  from rol_mdd_lector;

-- =============================================================================
-- Generar el JWT que usará Mapa del Delito
-- =============================================================================
-- El JWT se firma con el "JWT Secret" del proyecto (Supabase Dashboard →
-- Project Settings → API → JWT Settings → "JWT Secret", NO confundir con
-- las API keys). Guardar ese secret únicamente para firmar el token —
-- no se comparte con MdD ni se commitea.
--
-- Node.js (ejecutar UNA vez, localmente, para generar el JWT de MdD):
--
--   npm install jsonwebtoken
--
--   node -e '
--     const jwt = require("jsonwebtoken");
--     const secret = process.env.SUPABASE_JWT_SECRET; // pegar acá o env var
--     const token = jwt.sign(
--       {
--         role: "rol_mdd_lector",
--         iss: "supabase",
--         // Sin "sub"/"email": este JWT no representa a un usuario, es
--         // una credencial de servicio para MdD.
--       },
--       secret,
--       { expiresIn: "365d" } // rotar anualmente; documentar la fecha
--     );
--     console.log(token);
--   '
--
-- Ese token es el valor de `MDD... ` -- en realidad va del lado de MdD:
-- MdD lo usa como `apikey` Y como `Authorization: Bearer <token>` al
-- pegarle a PostgREST de BD Usina:
--
--   curl "https://<proyecto-bd-usina>.supabase.co/rest/v1/api_victimas_publicas?select=*&limit=5" \
--        -H "apikey: <el-jwt-generado>" \
--        -H "Authorization: Bearer <el-jwt-generado>"
--
-- Rotación: generar un JWT nuevo con el mismo comando (misma expiración
-- más larga) y actualizar la env var del lado de MdD. El rol y sus
-- permisos no cambian; sólo se re-firma el token.
--
-- Verificación (con el token ya generado):
--   curl -s "https://<proyecto-bd-usina>.supabase.co/rest/v1/api_victimas_publicas?select=*&limit=1" \
--        -H "apikey: <token>" -H "Authorization: Bearer <token>" | jq .
--   -- Debe devolver datos.
--
--   curl -s "https://<proyecto-bd-usina>.supabase.co/rest/v1/victimas?select=*&limit=1" \
--        -H "apikey: <token>" -H "Authorization: Bearer <token>"
--   -- Debe devolver [] o un error de permisos (nunca datos crudos).
