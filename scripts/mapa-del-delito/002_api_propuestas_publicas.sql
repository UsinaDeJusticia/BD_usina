-- =============================================================================
-- Vista `api_propuestas_publicas` — a correr en el proyecto Supabase de
-- MAPA DEL DELITO (NO en el de BD Usina).
-- =============================================================================
-- Sólo las propuestas pendientes de revisión. BD Usina lee de acá para
-- poblar la cola en `/candidatos`; el detalle completo de cada propuesta
-- también sale de esta vista (todas las columnas son relevantes para la
-- revisión humana, a diferencia de `api_victimas_publicas` del lado de
-- BD Usina, que sí filtra columnas por PII).
--
-- Es una vista "simple" (una sola tabla base, sin agregaciones) — Postgres
-- la trata como automáticamente actualizable, pero NO se usa para
-- escribir: el UPDATE de decisión va directo contra la tabla base
-- `propuestas_para_usina` (ver 003_rol_usina_revisor.sql) para evitar el
-- problema de `WITH CHECK OPTION` (una fila que pasa a 'aprobada' dejaría
-- de cumplir el `estado = 'pendiente'` de este WHERE, y un CHECK OPTION
-- rechazaría esa misma actualización).
-- -----------------------------------------------------------------------------

create or replace view public.api_propuestas_publicas as
select *
from public.propuestas_para_usina
where estado = 'pendiente'
order by detectado_at desc;

comment on view public.api_propuestas_publicas is
  'Propuestas pendientes de revisión, para consumo de BD Usina. '
  'Sólo lectura — el UPDATE de decisión va contra la tabla base.';

-- El GRANT de SELECT se hace en 003_rol_usina_revisor.sql.

-- Verificación:
--   select count(*) from public.api_propuestas_publicas;
