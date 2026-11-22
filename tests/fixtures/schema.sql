-- Esquema de prueba: emula Supabase (roles, auth.email(), storage) + tablas
-- de scripts/001..012 + columnas que la app usa y existen en producción.
-- Lo usan tests/save-case.test.ts y tests/sql-migrations.test.ts.
-- Los roles son globales del cluster y varios archivos de tests cargan este
-- fixture en paralelo: se toleran tanto el "ya existe" como la carrera.
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated','service_role'] loop
    begin
      execute format('create role %I nologin%s', r, case when r = 'service_role' then ' bypassrls' else '' end);
    exception when duplicate_object or unique_violation then null;
    end;
  end loop;
end $$;
create schema auth; create schema storage; create schema extensions;
create function auth.email() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'email' $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.email() to anon, authenticated;
create table storage.buckets (id text primary key, public bool, file_size_limit bigint, allowed_mime_types text[]);
insert into storage.buckets values ('archivos-casos', false, null, null);
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create table public.allowed_users (id serial primary key, email text not null);

-- Create victims table
CREATE TABLE IF NOT EXISTS public.victimas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo TEXT NOT NULL,
  edad INTEGER,
  fecha_nacimiento DATE,
  profesion TEXT,
  redes_sociales TEXT,
  telefono_contacto_familiar TEXT,
  direccion_completa TEXT,
  nacionalidad TEXT,
  notas_adicionales TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create incidents table (hechos)
CREATE TABLE IF NOT EXISTS public.hechos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  victima_id UUID REFERENCES public.victimas(id) ON DELETE CASCADE,
  fecha_hecho DATE,
  fecha_fallecimiento DATE,
  provincia TEXT,
  municipio TEXT,
  lugar_especifico TEXT,
  resumen_hecho TEXT,
  numero_causa TEXT,
  caratula TEXT,
  email_fiscalia TEXT,
  telefono_fiscalia TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create accused persons table (imputados)
CREATE TABLE IF NOT EXISTS public.imputados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hecho_id UUID REFERENCES public.hechos(id) ON DELETE CASCADE,
  apellido_nombre TEXT,
  menor_edad BOOLEAN DEFAULT FALSE,
  nacionalidad TEXT,
  juzgado_ufi TEXT,
  estado_procesal TEXT,
  fecha_veredicto DATE,
  pena TEXT,
  juicio_abreviado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trial dates table for multiple hearing dates
CREATE TABLE IF NOT EXISTS public.fechas_juicio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imputado_id UUID REFERENCES public.imputados(id) ON DELETE CASCADE,
  fecha_audiencia DATE NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create follow-up table (seguimiento)
CREATE TABLE IF NOT EXISTS public.seguimiento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hecho_id UUID REFERENCES public.hechos(id) ON DELETE CASCADE,
  miembro_asignado TEXT,
  contacto_familia TEXT,
  notas_seguimiento TEXT,
  tipo_acompanamiento TEXT[], -- Array for multiple support types
  abogado_querellante TEXT,
  amicus_curiae BOOLEAN DEFAULT FALSE,
  como_llego_caso TEXT,
  primer_contacto BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create resources table (recursos)
CREATE TABLE IF NOT EXISTS public.recursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hecho_id UUID REFERENCES public.hechos(id) ON DELETE CASCADE,
  imputado_id UUID REFERENCES public.imputados(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  url TEXT,
  fuente TEXT,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cases summary table for easier querying
CREATE TABLE IF NOT EXISTS public.casos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  victima_id UUID REFERENCES public.victimas(id) ON DELETE CASCADE,
  hecho_id UUID REFERENCES public.hechos(id) ON DELETE CASCADE,
  numero_involucrados INTEGER DEFAULT 1,
  estado_general TEXT DEFAULT 'En Proceso',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.victimas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hechos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imputados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fechas_juicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public access (since this is an internal NGO system)
-- Note: In a production environment, you might want more restrictive policies

-- Policies for victimas
CREATE POLICY "Allow all operations on victimas" ON public.victimas FOR ALL USING (true);

-- Policies for hechos
CREATE POLICY "Allow all operations on hechos" ON public.hechos FOR ALL USING (true);

-- Policies for imputados
CREATE POLICY "Allow all operations on imputados" ON public.imputados FOR ALL USING (true);

-- Policies for fechas_juicio
CREATE POLICY "Allow all operations on fechas_juicio" ON public.fechas_juicio FOR ALL USING (true);

-- Policies for seguimiento
CREATE POLICY "Allow all operations on seguimiento" ON public.seguimiento FOR ALL USING (true);

-- Policies for recursos
CREATE POLICY "Allow all operations on recursos" ON public.recursos FOR ALL USING (true);

-- Policies for casos
CREATE POLICY "Allow all operations on casos" ON public.casos FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_hechos_victima_id ON public.hechos(victima_id);
CREATE INDEX IF NOT EXISTS idx_imputados_hecho_id ON public.imputados(hecho_id);
CREATE INDEX IF NOT EXISTS idx_fechas_juicio_imputado_id ON public.fechas_juicio(imputado_id);
CREATE INDEX IF NOT EXISTS idx_seguimiento_hecho_id ON public.seguimiento(hecho_id);
CREATE INDEX IF NOT EXISTS idx_recursos_hecho_id ON public.recursos(hecho_id);
CREATE INDEX IF NOT EXISTS idx_recursos_imputado_id ON public.recursos(imputado_id);
CREATE INDEX IF NOT EXISTS idx_casos_victima_id ON public.casos(victima_id);
CREATE INDEX IF NOT EXISTS idx_casos_hecho_id ON public.casos(hecho_id);
-- Script para agregar la columna 'estado' a la tabla 'casos'
-- Esta columna permitirá rastrear el estado actual del caso

ALTER TABLE casos ADD COLUMN IF NOT EXISTS estado text DEFAULT 'En investigación';

-- Añadir un comentario a la columna para documentación
COMMENT ON COLUMN casos.estado IS 'Estado actual del caso: En investigación, Elevado a Juicio, Sentencia, Cerrado/Archivado';
-- Add prision_perpetua column to imputados table
ALTER TABLE public.imputados 
ADD COLUMN IF NOT EXISTS prision_perpetua BOOLEAN DEFAULT FALSE;

-- columnas que existen en prod según el código
alter table victimas add column provincia_residencia text, add column municipio_residencia text, add column fecha_hecho date, add column fecha_fallecimiento date;
alter table hechos add column tipo_crimen text, add column tipo_arma text, add column tipo_lugar text, add column lugar_otro text, add column localidad_barrio text, add column estado_caso text;
alter table recursos add column victima_id uuid references victimas(id), add column archivo_path text, add column archivo_nombre text, add column archivo_tipo text, add column archivo_size bigint;
alter table fechas_juicio add column hecho_id uuid;
create table public.instancias_judiciales (id uuid primary key default gen_random_uuid(), imputado_id uuid references imputados(id) on delete cascade, numero_causa text, fiscal text, fiscalia text, caratula text, orden_nivel text, created_at timestamptz default now());
alter table instancias_judiciales enable row level security;
-- política permisiva extra para el allowed_users (peor caso: cualquiera puede insertar)
alter table allowed_users enable row level security;
create policy "anyone" on allowed_users for all using (true) with check (true);
alter table seguimiento
  add column telefono_contacto text, add column email_contacto text, add column direccion_contacto text,
  add column telefono_miembro text, add column email_miembro text, add column fecha_asignacion date,
  add column proximas_acciones text, add column parentesco_contacto text, add column parentesco_otro text,
  add column lista_miembros_asignados jsonb, add column lista_contactos_familiares jsonb,
  add column datos_abogados_querellantes jsonb, add column tiene_abogado_querellante text,
  add column abogado_usina_amicus text, add column abogado_amicus_firmante text;
alter table seguimiento alter column primer_contacto type text using primer_contacto::text;
alter table imputados
  add column documento_identidad text, add column tribunal_fallo text, add column es_extranjero boolean,
  add column detenido_previo boolean, add column fallecido boolean, add column es_reincidente boolean,
  add column alias text, add column edad text, add column cargos text;
alter table fechas_juicio add column updated_at timestamptz default now();
-- Migration script to add missing RLS policy for instancias_judiciales table
-- This table had RLS enabled but no policy was created, blocking all operations

-- First, ensure RLS is enabled on the table (idempotent)
ALTER TABLE public.instancias_judiciales ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (to make this script idempotent)
DROP POLICY IF EXISTS "Allow all operations on instancias_judiciales" ON public.instancias_judiciales;

-- Create permissive policy for all operations (matching the pattern used for other tables)
CREATE POLICY "Allow all operations on instancias_judiciales" 
ON public.instancias_judiciales 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Verify the policy was created
-- You can run: SELECT * FROM pg_policies WHERE tablename = 'instancias_judiciales';
-- Script para agregar campos de "Otra intervención" a la tabla seguimiento
-- Ejecutar este script en Supabase SQL Editor

-- Agregar columna para el checkbox de "Otra intervención"
ALTER TABLE seguimiento
ADD COLUMN IF NOT EXISTS otra_intervencion BOOLEAN DEFAULT FALSE;

-- Agregar columna para la descripción de la intervención
ALTER TABLE seguimiento
ADD COLUMN IF NOT EXISTS otra_intervencion_descripcion TEXT;

-- Comentarios descriptivos para las columnas
COMMENT ON COLUMN seguimiento.otra_intervencion IS 'Indica si hubo otra intervención adicional por parte de UJ';
COMMENT ON COLUMN seguimiento.otra_intervencion_descripcion IS 'Descripción detallada de la otra intervención realizada';
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
-- =============================================================================
-- Indexes faltantes detectados en la auditoría de performance.
-- =============================================================================
-- Volúmenes actuales son chicos (cientos de filas), así que el impacto
-- inmediato es bajo. Estos indexes son "future-proofing" — apuntan a
-- queries que se ejecutan en hot paths:
--
--   - `casos` ordenado por created_at desc      -> listados de casos
--   - `allowed_users` lookup por email          -> middleware en cada request
--   - `recursos` filtrado por victima_id        -> detalle de caso
--   - `instancias_judiciales` por imputado_id   -> detalle de caso (embed)
--
-- Todos con `if not exists` para que sea idempotente.
-- Ejecutar UNA vez en SQL Editor del proyecto Supabase.
-- -----------------------------------------------------------------------------

create index if not exists idx_casos_created_at_desc
  on public.casos (created_at desc);

create unique index if not exists idx_allowed_users_email
  on public.allowed_users (email);

create index if not exists idx_recursos_victima_id
  on public.recursos (victima_id)
  where victima_id is not null;

create index if not exists idx_instancias_judiciales_imputado_id
  on public.instancias_judiciales (imputado_id);

-- Verificación:
--   select schemaname, tablename, indexname
--   from pg_indexes
--   where indexname like 'idx_casos_created_at_desc'
--      or indexname like 'idx_allowed_users_email'
--      or indexname like 'idx_recursos_victima_id'
--      or indexname like 'idx_instancias_judiciales_imputado_id';
