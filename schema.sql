-- =====================================================
-- SCHEMA COMPLETO BASE DE DATOS - USINA DE JUSTICIA
-- =====================================================
-- Generado basado en migraciones SQL y tipos TypeScript
-- Fecha: 2026-01-11
-- =====================================================

-- =====================================================
-- TABLAS PRINCIPALES
-- =====================================================

-- Create victims table
CREATE TABLE IF NOT EXISTS public.victimas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo TEXT NOT NULL,
  edad INTEGER,
  fecha_nacimiento DATE,
  profesion TEXT,
  nacionalidad TEXT,
  redes_sociales TEXT,
  notas_adicionales TEXT,
  provincia_residencia TEXT,
  municipio_residencia TEXT,
  fecha_hecho DATE,
  fecha_fallecimiento DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create incidents table (hechos)
CREATE TABLE IF NOT EXISTS public.hechos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  victima_id UUID REFERENCES public.victimas(id) ON DELETE CASCADE,
  fecha_hecho DATE,
  fecha_fallecimiento DATE,
  municipio TEXT,
  provincia TEXT,
  lugar_especifico TEXT,
  resumen_hecho TEXT,
  caratula TEXT,
  numero_causa TEXT,
  telefono_fiscalia TEXT,
  email_fiscalia TEXT,
  tipo_crimen TEXT,
  tipo_arma TEXT,
  tipo_lugar TEXT,
  lugar_otro TEXT,
  localidad_barrio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create accused persons table (imputados)
CREATE TABLE IF NOT EXISTS public.imputados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hecho_id UUID REFERENCES public.hechos(id) ON DELETE CASCADE,
  apellido_nombre TEXT,
  nacionalidad TEXT,
  menor_edad BOOLEAN DEFAULT FALSE,
  estado_procesal TEXT,
  juzgado_ufi TEXT,
  juicio_abreviado BOOLEAN DEFAULT FALSE,
  pena TEXT,
  prision_perpetua BOOLEAN DEFAULT FALSE,
  fecha_veredicto DATE,
  documento_identidad TEXT,
  tribunal_fallo TEXT,
  es_extranjero BOOLEAN,
  detenido_previo BOOLEAN,
  fallecido BOOLEAN,
  es_reincidente BOOLEAN,
  alias TEXT,
  edad TEXT,
  cargos TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trial dates table for multiple hearing dates
CREATE TABLE IF NOT EXISTS public.fechas_juicio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imputado_id UUID REFERENCES public.imputados(id) ON DELETE CASCADE,
  fecha_audiencia DATE,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create judicial instances table (instancias_judiciales)
CREATE TABLE IF NOT EXISTS public.instancias_judiciales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hecho_id UUID REFERENCES public.hechos(id) ON DELETE CASCADE,
  numero_causa TEXT,
  fiscal_fiscalia TEXT,
  caratula TEXT,
  orden_nivel TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create follow-up table (seguimiento)
CREATE TABLE IF NOT EXISTS public.seguimiento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hecho_id UUID REFERENCES public.hechos(id) ON DELETE CASCADE,
  primer_contacto DATE,
  como_llego_caso TEXT,
  miembro_asignado TEXT,
  contacto_familia TEXT,
  tipo_acompanamiento TEXT,
  abogado_querellante TEXT,
  amicus_curiae BOOLEAN DEFAULT FALSE,
  notas_seguimiento TEXT,
  telefono_contacto TEXT,
  email_contacto TEXT,
  direccion_contacto TEXT,
  telefono_miembro TEXT,
  email_miembro TEXT,
  fecha_asignacion DATE,
  proximas_acciones TEXT,
  parentesco_contacto TEXT,
  lista_miembros_asignados JSONB,
  lista_contactos_familiares JSONB,
  datos_abogados_querellantes JSONB,
  tiene_abogado_querellante TEXT,
  abogado_usina_amicus TEXT,
  otra_intervencion BOOLEAN DEFAULT FALSE,
  otra_intervencion_descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create resources table (recursos)
CREATE TABLE IF NOT EXISTS public.recursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hecho_id UUID REFERENCES public.hechos(id) ON DELETE CASCADE,
  imputado_id UUID REFERENCES public.imputados(id) ON DELETE SET NULL,
  tipo TEXT,
  titulo TEXT,
  descripcion TEXT,
  url TEXT,
  fuente TEXT,
  archivo_path TEXT,
  archivo_nombre TEXT,
  archivo_tipo TEXT,
  archivo_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cases summary table for easier querying
CREATE TABLE IF NOT EXISTS public.casos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  victima_id UUID REFERENCES public.victimas(id) ON DELETE CASCADE,
  hecho_id UUID REFERENCES public.hechos(id) ON DELETE CASCADE,
  estado_general TEXT,
  numero_involucrados INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable Row Level Security on all tables
ALTER TABLE public.victimas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hechos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imputados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fechas_juicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instancias_judiciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casos ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES (WHITELIST ESTRITA - PRODUCCIÓN)
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations on victimas" ON public.victimas;
DROP POLICY IF EXISTS "Allow all operations on hechos" ON public.hechos;
DROP POLICY IF EXISTS "Allow all operations on imputados" ON public.imputados;
DROP POLICY IF EXISTS "Allow all operations on fechas_juicio" ON public.fechas_juicio;
DROP POLICY IF EXISTS "Allow all operations on instancias_judiciales" ON public.instancias_judiciales;
DROP POLICY IF EXISTS "Allow all operations on seguimiento" ON public.seguimiento;
DROP POLICY IF EXISTS "Allow all operations on recursos" ON public.recursos;
DROP POLICY IF EXISTS "Allow all operations on casos" ON public.casos;

-- NOTE: Las políticas RLS fueron configuradas manualmente en producción con whitelist estricta.
-- Este script crea el esquema de base de datos pero no recrea las políticas RLS de producción.
-- Si necesitas las políticas específicas de producción, debes configurarlas manualmente.

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_hechos_victima_id ON public.hechos(victima_id);
CREATE INDEX IF NOT EXISTS idx_imputados_hecho_id ON public.imputados(hecho_id);
CREATE INDEX IF NOT EXISTS idx_fechas_juicio_imputado_id ON public.fechas_juicio(imputado_id);
CREATE INDEX IF NOT EXISTS idx_instancias_judiciales_hecho_id ON public.instancias_judiciales(hecho_id);
CREATE INDEX IF NOT EXISTS idx_seguimiento_hecho_id ON public.seguimiento(hecho_id);
CREATE INDEX IF NOT EXISTS idx_recursos_hecho_id ON public.recursos(hecho_id);
CREATE INDEX IF NOT EXISTS idx_recursos_imputado_id ON public.recursos(imputado_id);
CREATE INDEX IF NOT EXISTS idx_casos_victima_id ON public.casos(victima_id);
CREATE INDEX IF NOT EXISTS idx_casos_hecho_id ON public.casos(hecho_id);

-- =====================================================
-- AUTOMATED TRIGGER FOR UPDATED_AT
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for tables with updated_at
CREATE TRIGGER update_victimas_updated_at BEFORE UPDATE ON public.victimas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hechos_updated_at BEFORE UPDATE ON public.hechos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_imputados_updated_at BEFORE UPDATE ON public.imputados
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fechas_juicio_updated_at BEFORE UPDATE ON public.fechas_juicio
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_instancias_judiciales_updated_at BEFORE UPDATE ON public.instancias_judiciales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seguimiento_updated_at BEFORE UPDATE ON public.seguimiento
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recursos_updated_at BEFORE UPDATE ON public.recursos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casos_updated_at BEFORE UPDATE ON public.casos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STORAGE BUCKET INSTRUCTIONS
-- =====================================================

-- Para configurar el bucket de Storage, sigue estos pasos en el Dashboard de Supabase:
-- 1. Ve a Storage -> New bucket
-- 2. Name: archivos-casos
-- 3. Public bucket: YES
-- 4. File size limit: 50MB
-- 5. Políticas RLS:
--    - Public read: SELECT para anon, authenticated
--    - Authenticated uploads: INSERT para authenticated
--    - Authenticated deletes: DELETE para authenticated

-- =====================================================
-- END OF SCHEMA
-- =====================================================
