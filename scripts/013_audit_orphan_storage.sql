-- =============================================================================
-- Auditoría de archivos huérfanos en storage (SOLO LECTURA).
-- =============================================================================
-- Lista los objetos del bucket `archivos-casos` que ninguna fila de
-- `recursos.archivo_path` referencia. Son archivos que quedaron de
-- borrados viejos que no limpiaban el storage.
--
-- Ejecutar en el SQL Editor de Supabase. No modifica nada.
--
-- Para BORRAR los huérfanos usar `scripts/cleanup-orphan-files.mjs`
-- (el borrado debe ir por el API de storage, no por SQL directo: borrar
-- filas de storage.objects deja basura en el backend de archivos).
-- -----------------------------------------------------------------------------

-- 1. Huérfanos: en el bucket pero sin fila en recursos
select
  o.name as archivo,
  o.created_at,
  pg_size_pretty((o.metadata ->> 'size')::bigint) as tamano
from storage.objects o
where o.bucket_id = 'archivos-casos'
  and not exists (
    select 1 from public.recursos r where r.archivo_path = o.name
  )
order by o.created_at;

-- 2. Caso inverso: filas de recursos que apuntan a archivos inexistentes
--    (links rotos en la UI; revisar a mano)
select
  r.id,
  r.titulo,
  r.archivo_path,
  r.created_at
from public.recursos r
where r.archivo_path is not null
  and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'archivos-casos' and o.name = r.archivo_path
  )
order by r.created_at;

-- 3. Resumen rápido
select
  (select count(*) from storage.objects where bucket_id = 'archivos-casos') as archivos_en_bucket,
  (select count(distinct archivo_path) from public.recursos where archivo_path is not null) as paths_referenciados,
  (select count(*)
     from storage.objects o
     where o.bucket_id = 'archivos-casos'
       and not exists (select 1 from public.recursos r where r.archivo_path = o.name)
  ) as huerfanos;
