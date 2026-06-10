-- =============================================================================
-- RPC: get_dashboard_stats
-- =============================================================================
-- Devuelve en un solo round-trip todos los agregados que consume el
-- dashboard (KPIs, casos por año, por provincia, por estado procesal).
--
-- Reemplaza a 4-5 queries del cliente que bajaban tablas enteras y
-- contaban en JS. El payload pasa de varios KB por query a ~1 KB total.
--
-- Seguridad: `security invoker` -> respeta las policies RLS del caller.
-- Con las policies actuales (`Allow all operations`) el resultado es
-- accesible para anon, igual que las queries directas que reemplaza.
--
-- Ejecutar UNA vez en SQL Editor del proyecto Supabase.
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
         where coalesce(estado_procesal, '') <> 'Condenado') as cases_without_conviction,
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

-- Permitir invocar la RPC desde el frontend (anon + usuarios autenticados).
grant execute on function public.get_dashboard_stats() to anon, authenticated;

-- Verificar:
--   select public.get_dashboard_stats();
