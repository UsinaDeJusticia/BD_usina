-- =============================================================================
-- Vista sanitizada: api_victimas_publicas
-- =============================================================================
-- NO correr este script al aplicar el hardening de RLS. 014 no lo necesita
-- y la integración que iba a leer esta vista está en pausa. Queda en el
-- repo para cuando se retome. Si se ejecuta igual, el REVOKE del final
-- deja la vista sin acceso para anon, authenticated y public.
--
-- Expone sólo lo necesario para detectar duplicados y enriquecer el estado
-- oficial del caso (nombre + provincia + municipio + fecha del hecho + edad
-- + URLs de noticias).
--
-- Deliberadamente NO expone:
--   - Datos de contacto de víctima/familia (`telefono_contacto_familiar`,
--     `direccion_completa`, `redes_sociales`, `notas_adicionales`,
--     columnas de residencia).
--   - `resumen_hecho`, `numero_causa`, `caratula`, datos de fiscalía,
--     `lugar_especifico` (puede contener detalles sensibles/direcciones).
--   - Las tablas `imputados`, `instancias_judiciales`, `fechas_juicio`,
--     `seguimiento` completas.
--   - Archivos adjuntos (`archivo_path` y afines) — sólo URLs externas.
--
-- Raíz de la vista: `casos`, no `hechos`. `hechos.victima_id` sólo
-- referencia a la víctima "dueña" del hecho; cuando un hecho tiene varias
-- víctimas (hermanas), las adicionales sólo tienen fila en `casos`
-- (`casos.hecho_id` + `casos.victima_id` propio), sin fila propia en
-- `hechos`. Partir de `casos` es lo único que las incluye a todas.
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
  'Vista sanitizada. Sin PII de contacto ni datos de imputados/seguimiento. '
  'Sin GRANT para anon, authenticated ni public.';

-- En Supabase el CREATE VIEW hereda los default privileges y deja SELECT
-- (y el resto) otorgado a anon y authenticated. Este REVOKE lo deshace.
-- No otorga nada a ningún rol de lectura externo: ese GRANT no forma parte
-- de este cambio.
revoke all on public.api_victimas_publicas from anon, authenticated, public;
