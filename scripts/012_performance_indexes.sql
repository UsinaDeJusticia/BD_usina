-- =============================================================================
-- Indexes faltantes detectados en la auditoría de performance.
-- =============================================================================
-- Volúmenes actuales son chicos (cientos de filas), así que el impacto
-- inmediato es bajo. Estos indexes son "future-proofing" — apuntan a
-- queries que se ejecutan en hot paths:
--
--   - `casos` ordenado por created_at desc      -> listados de casos
--   - `allowed_users` lookup por email          -> middleware en cada request
--   - `recursos` filtrado por victima_id        -> detalle de caso
--   - `instancias_judiciales` por imputado_id   -> detalle de caso (embed)
--
-- Todos con `if not exists` para que sea idempotente.
-- Ejecutar UNA vez en SQL Editor del proyecto Supabase.
-- -----------------------------------------------------------------------------

create index if not exists idx_casos_created_at_desc
  on public.casos (created_at desc);

create unique index if not exists idx_allowed_users_email
  on public.allowed_users (email);

create index if not exists idx_recursos_victima_id
  on public.recursos (victima_id)
  where victima_id is not null;

create index if not exists idx_instancias_judiciales_imputado_id
  on public.instancias_judiciales (imputado_id);

-- Verificación:
--   select schemaname, tablename, indexname
--   from pg_indexes
--   where indexname like 'idx_casos_created_at_desc'
--      or indexname like 'idx_allowed_users_email'
--      or indexname like 'idx_recursos_victima_id'
--      or indexname like 'idx_instancias_judiciales_imputado_id';
