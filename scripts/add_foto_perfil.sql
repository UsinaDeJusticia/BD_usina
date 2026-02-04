-- Agregar columna foto_perfil a la tabla victimas
ALTER TABLE public.victimas ADD COLUMN IF NOT EXISTS foto_perfil TEXT;
