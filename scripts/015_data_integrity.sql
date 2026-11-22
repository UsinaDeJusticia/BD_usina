-- =============================================================================
-- 015 — Integridad de datos: borrado seguro de casos, URLs y uploads
-- =============================================================================
-- Requiere 013_harden_rls.sql aplicado antes (usa public.is_allowed_user()).
-- Todo en UNA transacción. No borra ni modifica filas existentes.
--
-- 1. public.delete_caso(uuid)
--    PROBLEMA: el botón "Eliminar caso" hacía `delete from casos where id=…`.
--      El ON DELETE CASCADE va de víctima -> caso, no al revés, así que la
--      víctima, el hecho, imputados, seguimiento y recursos quedaban huérfanos
--      (datos personales invisibles en la app pero vivos en la base).
--      Peor: si se borrara la víctima "principal" de un hecho compartido,
--      el FK hechos.victima_id ON DELETE CASCADE arrastraría el hecho y los
--      casos de las OTRAS víctimas.
--    SOLUCIÓN: una función transaccional que:
--      - Guarda un SNAPSHOT completo (jsonb) de todo lo que va a borrar en
--        admin_backup.casos_eliminados. Un borrado accidental es recuperable.
--      - Borra la víctima y sus recursos sólo si no está en otro caso.
--      - Borra el hecho y lo que cuelga de él sólo si ninguna otra víctima
--        lo comparte. Si lo comparte y el hecho apuntaba a esta víctima, lo
--        reasigna a otra víctima del hecho (evita el cascade descrito arriba).
--      - Nunca borra una víctima referenciada por otro hecho.
--      - NO borra archivos de Storage (quedan referenciados en el snapshot).
--    La app usa esta función si existe; si no, sigue con el borrado viejo.
--
-- 2. CHECK sobre recursos.url (sólo http/https o /api/files/…), NOT VALID:
--    se aplica a filas nuevas/actualizadas; las existentes no se tocan.
--    Abajo hay una consulta para revisarlas.
--
-- 3. Bucket archivos-casos: límite de 50 MB y tipos MIME permitidos del lado
--    servidor (antes sólo los validaba el navegador). Excluye SVG (puede
--    contener scripts). No afecta archivos ya subidos.
-- -----------------------------------------------------------------------------

begin;

-- 1. Borrado seguro -----------------------------------------------------------
create schema if not exists admin_backup;
revoke all on schema admin_backup from public;

create table if not exists admin_backup.casos_eliminados (
  id           bigint generated always as identity primary key,
  caso_id      uuid not null,
  eliminado_at timestamptz not null default now(),
  eliminado_por text,
  snapshot     jsonb not null
);

create or replace function public.delete_caso(p_caso_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caso            public.casos%rowtype;
  v_victima_shared  boolean := false;
  v_hecho_shared    boolean := false;
  v_victima_other_hechos boolean := false;
  v_imps            uuid[]  := '{}';
  v_snapshot        jsonb;
  v_has_instancias  boolean := to_regclass('public.instancias_judiciales') is not null;
  v_instancias      jsonb   := '[]'::jsonb;
begin
  -- Autorización explícita (security definer ignora RLS).
  if not public.is_allowed_user() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into v_caso from public.casos where id = p_caso_id for update;
  if not found then
    raise exception 'Caso no encontrado' using errcode = 'P0002';
  end if;

  if v_caso.victima_id is not null then
    select exists (select 1 from public.casos where victima_id = v_caso.victima_id and id <> p_caso_id)
      into v_victima_shared;
  end if;
  if v_caso.hecho_id is not null then
    select exists (select 1 from public.casos where hecho_id = v_caso.hecho_id and id <> p_caso_id)
      into v_hecho_shared;
    select coalesce(array_agg(id), '{}') into v_imps
      from public.imputados where hecho_id = v_caso.hecho_id;
  end if;

  if v_has_instancias and not v_hecho_shared and cardinality(v_imps) > 0 then
    execute 'select coalesce(jsonb_agg(to_jsonb(i)), ''[]''::jsonb)
             from public.instancias_judiciales i where imputado_id = any($1)'
      into v_instancias using v_imps;
  end if;

  -- Snapshot de TODO lo que se va a borrar, antes de borrar.
  v_snapshot := jsonb_build_object(
    'caso', to_jsonb(v_caso),
    'victima_compartida', v_victima_shared,
    'hecho_compartido', v_hecho_shared,
    'victima', case when v_victima_shared then null else
      (select to_jsonb(v) from public.victimas v where v.id = v_caso.victima_id) end,
    'recursos_victima', case when v_victima_shared then '[]'::jsonb else
      (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.recursos r
        where r.victima_id = v_caso.victima_id) end,
    'hecho', case when v_hecho_shared then null else
      (select to_jsonb(h) from public.hechos h where h.id = v_caso.hecho_id) end,
    'imputados', case when v_hecho_shared then '[]'::jsonb else
      (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.imputados i
        where i.hecho_id = v_caso.hecho_id) end,
    'fechas_juicio', case when v_hecho_shared then '[]'::jsonb else
      (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from public.fechas_juicio f
        where f.imputado_id = any(v_imps)) end,
    'instancias_judiciales', v_instancias,
    'seguimiento', case when v_hecho_shared then '[]'::jsonb else
      (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.seguimiento s
        where s.hecho_id = v_caso.hecho_id) end,
    'recursos_hecho', case when v_hecho_shared then '[]'::jsonb else
      (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.recursos r
        where r.hecho_id = v_caso.hecho_id or r.imputado_id = any(v_imps)) end
  );

  insert into admin_backup.casos_eliminados (caso_id, eliminado_por, snapshot)
  values (p_caso_id, auth.email(), v_snapshot);

  -- Recursos de la víctima (si no está en otro caso).
  if v_caso.victima_id is not null and not v_victima_shared then
    delete from public.recursos where victima_id = v_caso.victima_id;
  end if;

  delete from public.casos where id = p_caso_id;

  if v_caso.hecho_id is not null then
    if not v_hecho_shared then
      delete from public.recursos
        where hecho_id = v_caso.hecho_id or imputado_id = any(v_imps);
      if v_has_instancias and cardinality(v_imps) > 0 then
        execute 'delete from public.instancias_judiciales where imputado_id = any($1)' using v_imps;
      end if;
      delete from public.fechas_juicio where imputado_id = any(v_imps);
      delete from public.imputados where hecho_id = v_caso.hecho_id;
      delete from public.seguimiento where hecho_id = v_caso.hecho_id;
      delete from public.hechos where id = v_caso.hecho_id;
    elsif v_caso.victima_id is not null then
      -- Hecho compartido: si apuntaba a esta víctima, pasarlo a otra víctima
      -- del mismo hecho ANTES de borrar la víctima (evita el cascade).
      update public.hechos h
        set victima_id = (
          select c.victima_id from public.casos c
          where c.hecho_id = v_caso.hecho_id and c.victima_id is not null
          order by c.created_at limit 1)
        where h.id = v_caso.hecho_id and h.victima_id = v_caso.victima_id;
    end if;
  end if;

  if v_caso.victima_id is not null and not v_victima_shared then
    -- Si algún otro hecho todavía apunta a esta víctima, NO se borra: el
    -- cascade se llevaría ese hecho. Se conserva la víctima.
    select exists (select 1 from public.hechos where victima_id = v_caso.victima_id)
      into v_victima_other_hechos;
    if not v_victima_other_hechos then
      delete from public.victimas where id = v_caso.victima_id;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'victima_eliminada', v_caso.victima_id is not null and not v_victima_shared and not v_victima_other_hechos,
    'hecho_eliminado', v_caso.hecho_id is not null and not v_hecho_shared
  );
end;
$$;

revoke all on function public.delete_caso(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.delete_caso(uuid) from anon';
  end if;
end $$;
grant execute on function public.delete_caso(uuid) to authenticated;

-- 2. recursos.url -------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recursos_url_http_check' and conrelid = 'public.recursos'::regclass
  ) then
    alter table public.recursos
      add constraint recursos_url_http_check
      check (url is null or url = '' or url ~* '^https?://' or url like '/api/files/%')
      not valid;
  end if;
end $$;

-- 3. Bucket de Storage --------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets
      set file_size_limit = 52428800, -- 50 MB, igual que el front
          allowed_mime_types = array[
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'image/heic', 'image/heif', 'image/avif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'video/mp4', 'audio/mpeg'
          ]
      where id = 'archivos-casos';
  end if;
end $$;

commit;

-- -----------------------------------------------------------------------------
-- Consultas de diagnóstico (SÓLO LECTURA, no borran nada)
-- -----------------------------------------------------------------------------
-- Recursos existentes con URL no-http (posible XSS; corregir a mano):
--   select id, titulo, url from public.recursos
--   where not (url is null or url = '' or url ~* '^https?://' or url like '/api/files/%');
--
-- Datos huérfanos dejados por el borrado viejo (revisar antes de decidir):
--   select v.id, v.nombre_completo, v.created_at from public.victimas v
--   where not exists (select 1 from public.casos c where c.victima_id = v.id);
--
--   select h.id, h.created_at from public.hechos h
--   where not exists (select 1 from public.casos c where c.hecho_id = h.id);
--
-- Casos eliminados con la función nueva (recuperables desde el snapshot):
--   select id, caso_id, eliminado_at, eliminado_por,
--          snapshot->'victima'->>'nombre_completo' as victima
--   from admin_backup.casos_eliminados order by eliminado_at desc;
-- -----------------------------------------------------------------------------
