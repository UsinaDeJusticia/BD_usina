# Integración BD Usina ↔ Mapa del Delito

Este documento describe cómo las dos apps de Usina de Justicia —
**BD Usina** (este repo, base curada de víctimas) y **Mapa del Delito**
(MdD, scraping de noticias) — se conectan entre sí.

El plan completo de decisiones y fases está en el historial de este
repo; acá queda el contrato operativo para quien mantenga cualquiera de
los dos lados.

## Principios

1. **BD Usina es la fuente de verdad.** Ninguna víctima entra a la base
   curada sin revisión humana.
2. **El scraper nunca escribe en BD Usina.** MdD sólo *propone*; el flujo
   de escritura está invertido: BD Usina lee las propuestas desde MdD.
3. **PII no viaja a la infraestructura de scraping.** MdD nunca ve
   teléfonos, direcciones, notas de seguimiento ni datos de imputados.
4. **Credenciales acotadas por rol**, no por confianza. Cada lado tiene
   un rol Postgres dedicado con permisos mínimos, no las keys `anon`/
   `service_role` de uso general.

## Arquitectura

```
┌──────────────────────────────┐               ┌─────────────────────────┐
│         BD USINA             │               │    MAPA DEL DELITO      │
│                              │               │                         │
│ victimas/hechos (RLS:        │◄─ lee vista ──│ (server de MdD usa JWT  │
│  authenticated + whitelist)  │  JWT rol_mdd  │  rol_mdd_lector)        │
│ api_victimas_publicas        │               │                         │
│                              │               │ propuestas_para_usina   │
│ /api/candidatos/* (sesión) ──┼── lee vista ─►│ api_propuestas_publicas │
│ /candidatos (UI revisión)    │  JWT rol_usina│                         │
│ revisiones_candidatos_log    │── UPDATE ────►│ (estado, usina_victima_ │
│ pending_callbacks_mdd + cron │   decisión    │  id, motivo, decidido_*)│
└──────────────────────────────┘               └─────────────────────────┘
```

## 1. Lectura: BD Usina → MdD

MdD consume la vista `api_victimas_publicas` (definida en
`scripts/015_api_victimas_publicas.sql`) vía PostgREST, autenticado con
un JWT firmado para el rol `rol_mdd_lector` (creado en
`scripts/016_rol_mdd_lector.sql`).

### Columnas expuestas

| Columna | Descripción |
|---|---|
| `caso_id` | UUID del caso en BD Usina |
| `victima_id` | UUID de la víctima en BD Usina |
| `nombre_completo`, `edad`, `fecha_nacimiento`, `profesion`, `nacionalidad` | Datos básicos de identidad |
| `created_at`, `updated_at` | Timestamps de la víctima |
| `hecho_id`, `fecha_hecho`, `fecha_fallecimiento` | Identidad del hecho |
| `provincia`, `municipio` | Ubicación |
| `tipo_crimen`, `tipo_lugar` | Clasificación |
| `estado` | Estado oficial del caso (o `estado_general` si `estado` está vacío) |
| `recursos` | JSON array de `{titulo, url, fuente, tipo, created_at}` — sólo URLs externas, nunca archivos adjuntos |

### Columnas explícitamente NO expuestas

Teléfonos y direcciones de víctima/familia, `redes_sociales`,
`notas_adicionales`, `resumen_hecho`, `numero_causa`, `caratula`, datos de
fiscalía, y las tablas completas de `imputados`, `instancias_judiciales`,
`fechas_juicio`, `seguimiento`. Ningún `archivo_path` (adjuntos privados).

### Ejemplo de consulta

```bash
curl "https://<proyecto>.supabase.co/rest/v1/api_victimas_publicas?select=*&provincia=eq.Buenos%20Aires&order=created_at.desc&limit=20" \
  -H "apikey: $MDD_TOKEN" \
  -H "Authorization: Bearer $MDD_TOKEN"
```

Búsqueda fuzzy por nombre (para chequeo de duplicados):

```bash
curl "https://<proyecto>.supabase.co/rest/v1/api_victimas_publicas?select=*&nombre_completo=ilike.*maria*" \
  -H "apikey: $MDD_TOKEN" \
  -H "Authorization: Bearer $MDD_TOKEN"
```

### Generar tipos TypeScript

```bash
npx supabase gen types typescript --project-id <proyecto-bd-usina> \
  | grep -A 30 "api_victimas_publicas" > tipos-bd-usina.ts
```

## 2. Escritura: MdD → BD Usina (propuestas)

MdD mantiene su propia tabla `propuestas_para_usina` (schema completo
abajo). BD Usina la lee vía la vista `api_propuestas_publicas` de MdD,
con un JWT del rol `rol_usina_revisor`, y la muestra en `/candidatos`.

### Schema de `propuestas_para_usina` (en la BD de MdD)

```sql
create table propuestas_para_usina (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  alias text,
  edad_aproximada int,
  fecha_nacimiento date,
  genero text,
  nacionalidad text,
  fecha_hecho date,
  fecha_hecho_precision text, -- 'exacta' | 'dia_aprox' | 'mes_aprox' | 'año'
  fecha_fallecimiento date,
  provincia text,
  municipio text,
  tipo_crimen text,
  tipo_lugar text,
  resumen_corto text,
  fuentes jsonb not null,      -- [{url, titulo, fecha_publicacion, fuente_medio}]
  duplicado_check jsonb,       -- {ejecutado_at, match_score_max, posibles_matches:[{usina_victima_id, score}]}
  confianza_score numeric(4,3),
  estado text not null default 'pendiente'
    check (estado in ('pendiente','aprobada','rechazada','duplicada')),
  usina_victima_id uuid,
  motivo_rechazo text,
  decidido_at timestamptz,
  decidido_por text,
  detectado_at timestamptz default now(),
  scrapping_version text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Antes de insertar una propuesta, el pipeline de MdD debe consultar
`api_victimas_publicas` de BD Usina (nombre + provincia + fecha + edad)
y llenar `duplicado_check` con el resultado del fuzzy match.

### Flujo de revisión (en BD Usina)

1. `/candidatos` lista las propuestas en estado `pendiente` (vía
   `GET /api/candidatos`, que internamente lee `api_propuestas_publicas`
   de MdD con el JWT server-side — nunca expuesto al navegador).
2. **Aprobar**: abre `/casos/nuevo?fromCandidato=<id>` con los campos
   pre-rellenados (incluidas las `fuentes` como recursos de tipo
   "noticia"). Al guardar la ficha, se dispara
   `POST /api/candidatos/<id>/decidir` con `{decision:"aprobada",
   usina_victima_id}`.
3. **Rechazar**: `POST /api/candidatos/<id>/decidir` con
   `{decision:"rechazada", motivo}`.
4. **Es duplicado**: `{decision:"duplicada", usina_victima_id: <existente>}`.

Cada decisión queda en `revisiones_candidatos_log` (BD Usina) y se
refleja en `propuestas_para_usina.estado` (MdD) vía un UPDATE acotado
(sólo columnas `estado`, `usina_victima_id`, `motivo_rechazo`,
`decidido_at`, `decidido_por` — el rol `rol_usina_revisor` no tiene
ingún otro permiso sobre la tabla).

### Resiliencia

Si el UPDATE a MdD falla (MdD caído, JWT vencido), la decisión queda
igual aplicada en BD Usina y se encola en `pending_callbacks_mdd`. Un
cron de Vercel (`/api/cron/retry-mdd-callbacks`, cada 5 min) reintenta.

## Rotación de credenciales

- **JWT de `rol_mdd_lector`** (usado por MdD): se regenera con el
  comando en `scripts/016_rol_mdd_lector.sql`, expiración de 1 año.
  Actualizar la env var del lado de MdD tras rotar.
- **JWT de `rol_usina_revisor`** (usado por BD Usina): mismo mecanismo,
  documentado en el repo de MdD. Actualizar `MDD_SUPABASE_JWT` en Vercel.

## Fuera de alcance (por ahora)

- Log de accesos de lectura (sólo se audita el resultado de decisiones).
- Webhooks push de BD Usina hacia MdD.
- Auto-aprobación de recursos para víctimas ya existentes.
