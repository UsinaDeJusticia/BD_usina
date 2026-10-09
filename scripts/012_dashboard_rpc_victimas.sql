-- =============================================================================
-- RPC: get_dashboard_stats (versión centrada en la víctima)
-- =============================================================================
-- Reemplaza a scripts/011_dashboard_rpc.sql y a la versión de estado codes.
--
-- Unidad de conteo: la VÍCTIMA. Una víctima cuenta en el dashboard mientras
-- tenga al menos una fila en casos. Por eso, borrar un caso se refleja en las
-- cifras: si la víctima no tiene otros casos, deja de contar.
--
-- Estado de la víctima: el más avanzado entre los imputados de sus hechos
-- (imputados pertenecen al hecho y son compartidos por todas sus víctimas).
--   condenado > a_juicio > imputado_procesado > sospechoso > sin_condena
--   sin_condena agrupa absuelto, sobreseido, prescripcion y menor_inimputable.
--   Una víctima sin imputados queda en sin_imputado.
--
-- Año y provincia: salen del PRIMER hecho de la víctima (menor fecha_hecho).
--
-- KPI "Víctimas sin condena": víctimas cuyo estado es sin_condena.
--
-- Seguridad: security invoker, por lo que aplican las políticas RLS del caller
-- (ver scripts/013_rls_hardening.sql). Sólo se concede ejecución a
-- authenticated; anon no puede invocarla.
--
-- Ejecutar UNA vez en SQL Editor, después de 011 (o en lugar de ella) y antes
-- de 013.
-- -----------------------------------------------------------------------------

-- Rango de estado procesal. Acepta los códigos del formulario, los códigos y
-- etiquetas antiguos (en inglés y en español) y devuelve un número: menor = más
-- avanzado. Un valor nulo o desconocido devuelve 6 (sin estado).
create or replace function public.estado_procesal_rank(estado text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select (case lower(btrim(estado))
    when 'condenado'           then 1
    when 'convicted'           then 1
    when 'a_juicio'            then 2
    when 'a juicio'            then 2
    when 'en juicio'           then 2
    when 'trial'               then 2
    when 'imputado_procesado'  then 3
    when 'imputado/procesado'  then 3
    when 'procesado'           then 3
    when 'sospechoso'          then 4
    when 'absuelto'            then 5
    when 'acquitted'           then 5
    when 'sobreseido'          then 5
    when 'sobreseído'          then 5
    when 'dismissed'           then 5
    when 'prescripcion'        then 5
    when 'prescripción'        then 5
    when 'prescription'        then 5
    when 'menor_inimputable'   then 5
    when 'menor inimputable'   then 5
    else 6
  end)::smallint
$$;

create or replace function public.get_dashboard_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with caso_victima as (
    -- Una fila por caso con víctima. Los casos sin víctima no cuentan.
    select
      c.victima_id,
      c.hecho_id,
      c.created_at as caso_creado,
      h.fecha_hecho,
      h.provincia
    from public.casos c
    left join public.hechos h on h.id = c.hecho_id
    where c.victima_id is not null
  ),
  victimas_con_caso as (
    -- Una fila por víctima. registrada_en = alta de su primer caso.
    select victima_id, min(caso_creado) as registrada_en
    from caso_victima
    group by victima_id
  ),
  primer_hecho as (
    -- Primer hecho de cada víctima (fecha más antigua; sin fecha al final).
    select distinct on (victima_id) victima_id, fecha_hecho, provincia
    from caso_victima
    order by victima_id, fecha_hecho asc nulls last, caso_creado asc
  ),
  rango_estado as (
    -- Mejor (menor) rango entre los imputados de los hechos de cada víctima.
    select cv.victima_id, min(public.estado_procesal_rank(i.estado_procesal)) as rango
    from caso_victima cv
    join public.imputados i on i.hecho_id = cv.hecho_id
    group by cv.victima_id
  ),
  estado_victima as (
    select
      v.victima_id,
      case r.rango
        when 1 then 'condenado'
        when 2 then 'a_juicio'
        when 3 then 'imputado_procesado'
        when 4 then 'sospechoso'
        when 5 then 'sin_condena'
        when 6 then 'sin_estado'
        else 'sin_imputado'
      end as estado
    from victimas_con_caso v
    left join rango_estado r on r.victima_id = v.victima_id
  ),
  kpis as (
    select
      (select count(*) from victimas_con_caso) as total,
      (select count(*) from victimas_con_caso
         where registrada_en >= now() - interval '1 year') as ultimo_anio,
      (select count(*) from estado_victima where estado = 'sin_condena') as sin_condena
  ),
  por_anio as (
    select coalesce(
      jsonb_agg(jsonb_build_object('year', y.anio::text, 'victimas', y.n) order by y.anio),
      '[]'::jsonb
    ) as data
    from (
      select extract(year from fecha_hecho)::int as anio, count(*)::int as n
      from primer_hecho
      where fecha_hecho is not null
      group by extract(year from fecha_hecho)
    ) y
  ),
  sin_fecha as (
    select count(*)::int as n from primer_hecho where fecha_hecho is null
  ),
  por_provincia as (
    select coalesce(
      jsonb_agg(jsonb_build_object('provincia', p.provincia, 'victimas', p.n)
                order by p.n desc, p.provincia),
      '[]'::jsonb
    ) as data
    from (
      select coalesce(provincia, 'Sin dato') as provincia, count(*)::int as n
      from primer_hecho
      group by coalesce(provincia, 'Sin dato')
    ) p
  ),
  por_estado as (
    select coalesce(
      jsonb_agg(jsonb_build_object('status', e.estado, 'victimas', e.n) order by e.n desc),
      '[]'::jsonb
    ) as data
    from (
      select estado, count(*)::int as n
      from estado_victima
      group by estado
    ) e
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'totalVictimas',       k.total,
      'victimasUltimoAnio',  k.ultimo_anio,
      'victimasSinCondena',  k.sin_condena
    ),
    'victimasByYear',     y.data,
    'victimasSinFecha',   s.n,
    'victimasByProvince', p.data,
    'victimasByStatus',   e.data
  )
  from kpis k, por_anio y, sin_fecha s, por_provincia p, por_estado e;
$$;

-- Ejecución sólo para usuarios autenticados. anon y PUBLIC no pueden invocar
-- la función ni los helpers.
revoke all on function public.get_dashboard_stats() from public, anon;
grant execute on function public.get_dashboard_stats() to authenticated;
revoke all on function public.estado_procesal_rank(text) from public, anon;
grant execute on function public.estado_procesal_rank(text) to authenticated;

-- Verificar (con sesión de un usuario autorizado):
--   select public.get_dashboard_stats();
