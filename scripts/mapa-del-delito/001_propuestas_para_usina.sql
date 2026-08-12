-- =============================================================================
-- Tabla `propuestas_para_usina` — a correr en el proyecto Supabase de
-- MAPA DEL DELITO (NO en el de BD Usina).
-- =============================================================================
-- Cola de víctimas candidatas detectadas por el scraper. BD Usina las lee
-- (nunca escribe filas nuevas acá) y, tras revisión humana, actualiza sólo
-- las columnas de decisión vía un rol acotado (ver 003_rol_usina_revisor.sql).
--
-- Contrato completo en docs/integracion-mapa-del-delito.md (repo BD Usina).
-- -----------------------------------------------------------------------------

create table if not exists public.propuestas_para_usina (
  id                    uuid primary key default gen_random_uuid(),

  -- Víctima propuesta
  nombre_completo       text not null,
  alias                 text,
  edad_aproximada       int,
  fecha_nacimiento      date,
  genero                text,
  nacionalidad          text,

  -- Hecho
  fecha_hecho           date,
  fecha_hecho_precision text check (fecha_hecho_precision in
                          ('exacta','dia_aprox','mes_aprox','año')),
  fecha_fallecimiento   date,
  provincia             text,
  municipio             text,
  tipo_crimen           text,
  tipo_lugar            text,
  resumen_corto         text,

  -- Evidencia y deduplicación (llenados por el pipeline de scraping)
  fuentes               jsonb not null default '[]'::jsonb,
    -- [{url, titulo, fecha_publicacion, fuente_medio}]
  duplicado_check       jsonb,
    -- {ejecutado_at, match_score_max, posibles_matches:[{usina_victima_id, score}]}
  confianza_score       numeric(4,3),

  -- Workflow de revisión (las únicas columnas que BD Usina puede escribir)
  estado                text not null default 'pendiente'
                          check (estado in ('pendiente','aprobada','rechazada','duplicada')),
  usina_victima_id      uuid,
  motivo_rechazo        text,
  decidido_at           timestamptz,
  decidido_por          text,

  -- Metadatos del scraper
  detectado_at          timestamptz not null default now(),
  scrapping_version     text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_propuestas_estado
  on public.propuestas_para_usina (estado);

create index if not exists idx_propuestas_detectado_at
  on public.propuestas_para_usina (detectado_at desc);

alter table public.propuestas_para_usina enable row level security;

-- Nota: NO se crea acá ninguna policy para el pipeline propio de MdD
-- (INSERT de propuestas nuevas) — eso depende de cómo MdD autentica sus
-- propios procesos internos y queda a criterio del repo de MdD. Las
-- policies de este script son sólo las que necesita BD Usina; ver
-- 003_rol_usina_revisor.sql.

comment on table public.propuestas_para_usina is
  'Cola de víctimas candidatas detectadas por scraping, pendientes de '
  'revisión humana en BD Usina. BD Usina sólo puede leer vía '
  'api_propuestas_publicas y actualizar estado/usina_victima_id/'
  'motivo_rechazo/decidido_at/decidido_por — nunca insertar ni borrar.';
