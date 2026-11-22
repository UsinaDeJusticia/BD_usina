-- =============================================================================
-- 013 ROLLBACK — Volver a las políticas anteriores a 013_harden_rls.sql
-- =============================================================================
-- Usar SÓLO si 013 rompió algo y hace falta volver atrás de inmediato.
-- Restaura exactamente las políticas guardadas en admin_backup.policies_013
-- (el snapshot de la primera ejecución de 013) y devuelve los grants a `anon`.
--
-- OJO: vuelve a dejar la base abierta a la anon key. Es una medida temporal
-- mientras se diagnostica el problema.
--
-- No modifica ninguna fila de datos.
-- -----------------------------------------------------------------------------

begin;

do $$
declare
  t      text;
  pol    record;
  snap   timestamptz;
  roles_sql text;
begin
  select min(backed_up_at) into snap from admin_backup.policies_013;
  if snap is null then
    raise exception 'No hay backup en admin_backup.policies_013';
  end if;

  foreach t in array array['victimas','hechos','imputados','fechas_juicio','seguimiento',
                           'recursos','casos','instancias_judiciales','allowed_users']
  loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;

    -- Quitar las políticas creadas por 013.
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;

    -- Recrear las del backup.
    for pol in
      select * from admin_backup.policies_013 where backed_up_at = snap and tablename = t
    loop
      select string_agg(case when r = 'public' then 'public' else quote_ident(r) end, ', ')
        into roles_sql
      from unnest(pol.roles) as r;

      execute format(
        'create policy %I on public.%I as %s for %s to %s %s %s',
        pol.policyname, t, pol.permissive, pol.cmd, coalesce(roles_sql, 'public'),
        case when pol.qual is not null then 'using (' || pol.qual || ')' else '' end,
        case when pol.with_check is not null then 'with check (' || pol.with_check || ')' else '' end
      );
    end loop;

    if t <> 'allowed_users' then
      execute format('grant select, insert, update, delete on public.%I to anon', t);
    end if;
  end loop;

  if to_regprocedure('public.get_dashboard_stats()') is not null then
    execute 'grant execute on function public.get_dashboard_stats() to anon';
  end if;
end $$;

commit;
