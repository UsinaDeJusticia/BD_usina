-- =====================================================
-- SCHEMA MAESTRO - FUENTE DE VERDAD
-- Incluye: allowed_users, columna estado_caso y correcciones de sintaxis
-- =====================================================

-- 1. TABLA DE USUARIOS (Sistema de Whitelist)
CREATE TABLE IF NOT EXISTS public.allowed_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABLAS PRINCIPALES DEL SISTEMA

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
  foto_perfil TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hechos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  victima_id UUID REFERENCES public.victimas(id) ON DELETE CASCADE,
  estado_caso TEXT, -- COLUMNA CRÍTICA AGREGADA
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
  es_extranjero BOOLEAN DEFAULT FALSE,
  detenido_previo BOOLEAN DEFAULT FALSE,
  fallecido BOOLEAN DEFAULT FALSE,
  es_reincidente BOOLEAN DEFAULT FALSE,
  alias TEXT,
  edad INTEGER, -- CORREGIDO a Integer
  cargos TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fechas_juicio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imputado_id UUID REFERENCES public.imputados(id) ON DELETE CASCADE,
  fecha_audiencia DATE,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
  parentesco_otro TEXT,
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

CREATE TABLE IF NOT EXISTS public.casos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  victima_id UUID REFERENCES public.victimas(id) ON DELETE CASCADE,
  hecho_id UUID REFERENCES public.hechos(id) ON DELETE CASCADE,
  estado_general TEXT,
  numero_involucrados INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. FUNCIÓN AUTOMÁTICA DE FECHA (Sintaxis corregida)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- NOTA: Las Políticas RLS (Seguridad) se administran según el entorno (Prod/Dev)
-- y no están hardcodeadas en este esquema estructural.
