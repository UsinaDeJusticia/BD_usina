-- =============================================================================
-- 017 — Foto de perfil de la víctima
-- =============================================================================
-- Agrega public.victimas.foto_path: la ruta, dentro del bucket privado
-- `archivos-casos`, de la foto de perfil ya recortada (cuadrada, liviana).
--
-- - Columna NUEVA y OPCIONAL (null = sin foto: la app muestra las iniciales).
-- - No modifica ninguna fila existente.
-- - Compatible con la versión anterior de la app (que ignora la columna), así
--   que se puede aplicar ANTES de desplegar el código nuevo.
-- - Las fotos se suben bajo `fotos-perfil/`; las políticas de Storage de
--   010_secure_storage.sql (authenticated + whitelist) ya las cubren.
-- - La RLS de victimas (013) ya restringe quién puede leer/escribir la columna.
-- -----------------------------------------------------------------------------

begin;

alter table public.victimas
  add column if not exists foto_path text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'victimas_foto_path_check' and conrelid = 'public.victimas'::regclass
  ) then
    alter table public.victimas
      add constraint victimas_foto_path_check
      check (foto_path is null or (foto_path like 'fotos-perfil/%' and foto_path not like '%..%'));
  end if;
end $$;

comment on column public.victimas.foto_path is
  'Ruta en el bucket privado archivos-casos de la foto de perfil recortada (fotos-perfil/...). Null = sin foto.';

commit;

-- Verificación (sólo lectura):
--   select column_name, data_type, is_nullable from information_schema.columns
--   where table_schema = 'public' and table_name = 'victimas' and column_name = 'foto_path';
