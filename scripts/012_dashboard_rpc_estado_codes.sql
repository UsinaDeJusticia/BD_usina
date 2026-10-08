-- =============================================================================
-- RPC: get_dashboard_stats (versión 2)
-- =============================================================================
-- Reemplaza la función de scripts/011_dashboard_rpc.sql. Único cambio de
-- lógica: "Casos sin Condena" ya no compara contra la etiqueta 'Condenado'.
-- El formulario de casos guarda el código 'condenado' (ver
-- ESTADO_PROCESAL_OPTIONS en components/cases/forms/accused-form.tsx), así que
-- la comparación anterior contaba a los condenados como "sin condena".
-- Se usa lower() para que también cuente los registros viejos con la etiqueta,
-- y se incluye 'convicted', el código en inglés que guardaba el formulario
-- antes del commit b8e7b34.
--
-- Pendiente de decisión (no cambiado aquí): "En Investigación" compara contra
-- 'En investigación', valor que ningún formulario escribe. Hay que definir qué
-- códigos cuentan como "en investigación" antes de cambiarlo.
--
-- Ejecutar UNA vez en SQL Editor del proyecto Supabase, después de 011.
-- Seguridad: igual que 011 (security invoker, grant a anon y authenticated).
-- -----------------------------------------------------------------------------

create or replace function public.get_dashboard_stats()
returns jsonb
language sql
stable
security invoker
as $$
  with kpis as (
    select
      (select count(*) from public.victimas) as total_cases,
      (select count(*) from public.victimas
         where created_at >= now() - interval '1 year') as cases_last_year,
      (select count(*) from public.imputados
         where coalesce(lower(estado_procesal), '') not in ('condenado', 'convicted')) as cases_without_conviction,
      (select count(*) from public.imputados
         where estado_procesal = 'En investigación') as cases_in_investigation
  ),
  by_year as (
    select coalesce(
      jsonb_agg(jsonb_build_object('year', year::text, 'cases', cases) order by year),
      '[]'::jsonb
    ) as data
    from (
      select extract(year from fecha_hecho)::int as year, count(*)::int as cases
      from public.hechos
      where fecha_hecho is not null
      group by extract(year from fecha_hecho)
    ) y
  ),
  by_province as (
    select coalesce(
      jsonb_agg(jsonb_build_object('provincia', provincia, 'cases', cases) order by cases desc),
      '[]'::jsonb
    ) as data
    from (
      select provincia, count(*)::int as cases
      from public.hechos
      where provincia is not null
      group by provincia
    ) p
  ),
  by_status as (
    select coalesce(
      jsonb_agg(jsonb_build_object('status', status, 'cases', cases) order by cases desc),
      '[]'::jsonb
    ) as data
    from (
      select coalesce(estado_procesal, 'Otros') as status, count(*)::int as cases
      from public.imputados
      group by coalesce(estado_procesal, 'Otros')
    ) s
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'totalCases',              k.total_cases,
      'casesLastYear',           k.cases_last_year,
      'casesWithoutConviction',  k.cases_without_conviction,
      'casesInInvestigation',    k.cases_in_investigation
    ),
    'casesByYear',     y.data,
    'casesByProvince', p.data,
    'casesByStatus',   s.data
  )
  from kpis k, by_year y, by_province p, by_status s;
$$;

grant execute on function public.get_dashboard_stats() to anon, authenticated;

-- Verificar:
--   select public.get_dashboard_stats();
