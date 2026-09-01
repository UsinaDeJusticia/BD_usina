-- =============================================================================
-- Vista sanitizada para Mapa del Delito: api_victimas_publicas
-- =============================================================================
-- Expone SOLO lo necesario para que Mapa del Delito (MdD) pueda:
--   1. Detectar duplicados antes de proponer una víctima nueva (nombre +
--      provincia + municipio + fecha del hecho + edad).
--   2. Enriquecer su propio modelo con el estado oficial del caso y las
--      URLs de noticias que Usina ya catalogó como recursos.
--
-- Deliberadamente NO expone (ver docs/integracion-mapa-del-delito.md):
--   - Datos de contacto de víctima/familia (`telefono_contacto_familiar`,
--     `direccion_completa`, `redes_sociales`, `notas_adicionales`,
--     columnas de residencia).
--   - `resumen_hecho`, `numero_causa`, `caratula`, datos de fiscalía,
--     `lugar_especifico` (puede contener detalles sensibles/direcciones).
--   - Las tablas `imputados`, `instancias_judiciales`, `fechas_juicio`,
--     `seguimiento` completas (datos de imputados, del equipo, del
--     acompañamiento).
--   - Archivos adjuntos (`archivo_path` y afines) — sólo URLs externas.
--
-- Raíz de la vista: `casos`, no `hechos`. `hechos.victima_id` sólo
-- referencia a la víctima "dueña" del hecho; cuando un hecho tiene varias
-- víctimas (hermanas), las adicionales sólo tienen fila en `casos`
-- (`casos.hecho_id` + `casos.victima_id` propio), sin fila propia en
-- `hechos`. Partir de `casos` es lo único que las incluye a todas.
--
-- El acceso está limitado por GRANT, no por RLS de la vista: sólo el rol
-- `rol_mdd_lector` (ver 016_rol_mdd_lector.sql) tiene SELECT. Las tablas
-- base le están explícitamente negadas (ver 014_harden_rls.sql).
-- -----------------------------------------------------------------------------

create or replace view public.api_victimas_publicas as
select
  c.id                as caso_id,
  v.id                as victima_id,
  v.nombre_completo,
  v.edad,
  v.fecha_nacimiento,
  v.profesion,
  v.nacionalidad,
  v.created_at,
  v.updated_at,
  h.id                as hecho_id,
  h.fecha_hecho,
  h.fecha_fallecimiento,
  h.provincia,
  h.municipio,
  h.tipo_crimen,
  h.tipo_lugar,
  coalesce(nullif(trim(c.estado), ''), nullif(trim(c.estado_general), ''), 'En investigación') as estado,
  coalesce(recursos_agg.recursos, '[]'::jsonb) as recursos
from public.casos c
join public.victimas v on v.id = c.victima_id
left join public.hechos h on h.id = c.hecho_id
left join lateral (
  select jsonb_agg(
           jsonb_build_object(
             'titulo', r.titulo,
             'url', r.url,
             'fuente', r.fuente,
             'tipo', r.tipo,
             'created_at', r.created_at
           )
           order by r.created_at desc
         ) as recursos
  from public.recursos r
  where r.hecho_id = h.id
    and r.url is not null
    and r.archivo_path is null
) recursos_agg on true;

comment on view public.api_victimas_publicas is
  'Vista sanitizada para integración con Mapa del Delito. Sin PII de contacto '
  'ni datos de imputados/seguimiento. Ver scripts/016_rol_mdd_lector.sql para '
  'el rol autorizado a leerla.';

-- El GRANT de SELECT se hace en 016_rol_mdd_lector.sql, junto con la
-- creación del rol dedicado. Esta vista por sí sola no es alcanzable por
-- `anon` ni `authenticated` (no tienen GRANT), sólo por el owner y por
-- quien reciba el GRANT explícito.

-- Verificación:
--   select * from public.api_victimas_publicas limit 5;
--   -- (como owner/service_role; el rol_mdd_lector se prueba desde 016)
