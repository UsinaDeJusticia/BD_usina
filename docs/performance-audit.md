# Auditoría de performance — BD Usina

Fecha: 2026-06-09 · Rama: `claude/performance-audit`

Alcance: indexes, cache, payloads y rendering de la app Next.js 15 + Supabase.
Este documento identifica los cuellos de botella actuales y propone un plan de
implementación. **No incluye cambios de código** (solo análisis y plan).

---

## 1. Cuellos de botella principales (ordenados por impacto)

### 1.1 🔴 N+1 queries en los listados de casos

Archivos: `app/casos/page.tsx`, `components/cases/cases-grid.tsx`,
`components/cases/animated-cases-grid.tsx` (la misma lógica está duplicada 3 veces).

El patrón actual:

1. Trae **todos** los casos (`select ... order by created_at`, sin `limit`).
2. Por **cada caso** dispara una query individual a `seguimiento`
   (`.eq("hecho_id", ...).limit(1).maybeSingle()`).

Con N casos son **N+1 requests HTTP** desde el browser a Supabase. Con 200
casos: 201 round-trips (~50-150 ms c/u desde Argentina a us-east). Es la causa
dominante del tiempo de carga de la home y de `/casos`.

Agravante: la home monta `AnimatedCasesGrid` por defecto, así que este costo se
paga en la primera pantalla que ve todo usuario.

### 1.2 🔴 Cascada secuencial en el detalle de caso

Archivo: `components/cases/case-detail-content.tsx` (`loadFullCaseData`).

La carga de un caso encadena ~8-12 queries **secuenciales** (víctima → hecho →
imputados → instancias por imputado (N+1) → seguimiento → recursos del hecho →
recursos de la víctima → recursos por imputado (N+1) → hermanos de hecho).
Cada `await` espera al anterior aunque la mayoría son independientes.

### 1.3 🔴 Todo es client-side rendering sin cache

Todas las páginas con datos son `"use client"` + `useEffect` + fetch desde el
browser. Consecuencias:

- **Cascada de arranque**: middleware → HTML vacío → descarga JS → `AuthGuard`
  resuelve sesión (spinner bloqueante en `components/auth/auth-guard.tsx`) →
  recién ahí empiezan los fetch de datos → N+1.
- **Cero cache**: no hay `revalidate`, ni cache de datos, ni SWR/React Query.
  Cada navegación re-fetchea todo desde cero (ir a un caso y volver al listado
  vuelve a disparar las 200+ queries).
- Next 15 App Router está usado solo como router; no se aprovecha ni Server
  Components ni el data cache.

### 1.4 🟡 Middleware: 2 round-trips a Supabase por navegación

Archivo: `lib/supabase/middleware.ts`.

En **cada request** (matcher cubre casi todo) hace `auth.getUser()` (llamada de
red al endpoint de Auth) **más** una query a `allowed_users`. Son ~100-300 ms
agregados a cada navegación, antes de servir un solo byte de página. La
whitelist no se cachea de ninguna forma. Encima `AuthGuard` repite el chequeo
de sesión en el cliente (doble validación).

### 1.5 🟡 Dashboard: trae filas enteras para contar

Archivos: `components/dashboard/*.tsx`.

Las 4 secciones traen **todas las filas** y cuentan/agrupan en JS:
`dashboard-stats` baja todas las víctimas + todos los imputados; el chart por
año baja todos los `fecha_hecho`; el mapa todas las `provincia`; el de estados
todos los `estado_procesal`. El payload crece linealmente con la BD cuando
la respuesta correcta son agregaciones (`count`, `group by`) que devuelven
bytes. Además son 5 queries paralelas no compartidas (stats pide lo mismo que
los charts).

### 1.6 🟡 Payloads con `select("*")` y JSON pesado

- `case-detail-content.tsx` usa `select("*")` en victimas, hechos, imputados,
  seguimiento y recursos — incluye campos largos (notas, resúmenes, arrays
  JSON de contactos/abogados) aunque la vista no los muestre todos.
- Los listados piden `lista_contactos_familiares` (JSON) completo por fila
  para mostrar solo nombre/parentesco/teléfono del primer contacto.

### 1.7 🟡 Rendering: vista animada triplica el DOM

`components/cases/animated-cases-grid.tsx` duplica el dataset ×3
(`[...cases, ...cases, ...cases]`) para el efecto marquee y anima con
`hover:scale-105` + sombras. Con 200 casos son **600 cards** montadas y
animadas en la home. Costo alto de layout/paint, especialmente en máquinas
modestas. No hay virtualización.

### 1.8 🟢 Menores

- ~20 `console.log` en hot paths (uno por caso por render de listado;
  serializan objetos grandes).
- `recharts` (~100 KB gz) entra en el bundle del dashboard sin import dinámico.
- `next.config.mjs`: `images.unoptimized: true` (sin optimización de imágenes)
  e `ignoreBuildErrors: true` (deuda, no perf).
- Filtrado y paginación 100% en cliente: correcto mientras la tabla sea chica,
  pero ya hoy obliga a bajar todo para mostrar 12.

### 1.9 Indexes (estado actual: razonable)

`scripts/001_create_tables.sql` ya crea indexes en todas las FKs usadas
(`hechos.victima_id`, `imputados.hecho_id`, `seguimiento.hecho_id`,
`recursos.hecho_id/imputado_id`, `casos.victima_id/hecho_id`). Faltantes
detectados (impacto bajo con volúmenes actuales, conviene dejarlos listos):

| Index faltante | Query que lo usa |
|---|---|
| `casos(created_at desc)` | `order by created_at` en todos los listados |
| `recursos(victima_id)` | recursos por víctima en detalle de caso (columna agregada post-schema, sin index) |
| `instancias_judiciales(imputado_id)` | instancias por imputado en detalle |
| `allowed_users(email)` (unique) | chequeo de whitelist en **cada request** del middleware |

> Nota: con cientos/miles de filas, Postgres resuelve esto rápido incluso sin
> index. El problema dominante NO son los indexes sino la cantidad de
> round-trips (1.1–1.4).

---

## 2. Plan de implementación propuesto

Ordenado por relación impacto/esfuerzo. Cada fase es deployable por separado.

### Fase 1 — Eliminar los N+1 (impacto: alto, esfuerzo: bajo)

1. **Listados**: reemplazar el loop de queries a `seguimiento` por un único
   fetch embebido en la query principal de PostgREST:
   `casos.select("..., hechos(..., seguimiento(lista_contactos_familiares))")`,
   o un segundo fetch batch con `.in("hecho_id", [...])`. Resultado: de N+1
   requests a 1-2.
2. **Detalle de caso**: paralelizar las queries independientes con
   `Promise.all` y embeber `instancias_judiciales(*)` en la query de imputados
   y los 3 tipos de recursos en una sola query con `.or(...)`. Resultado: de
   ~8-12 round-trips secuenciales a 2-3 paralelos.
3. **Unificar la lógica duplicada** de los 3 listados en un hook/función
   compartida (`lib/data/casos.ts`) para no arreglar lo mismo 3 veces.
4. Borrar los `console.log` de hot paths.

### Fase 2 — Agregaciones en el dashboard (impacto: alto, esfuerzo: bajo)

1. Crear una función RPC en Postgres (`get_dashboard_stats()`) o una vista que
   devuelva los conteos ya agregados (total, último año, sin condena, en
   investigación, casos por año, por provincia, por estado procesal).
2. El dashboard pasa de 5 queries que bajan tablas enteras a **1 RPC** que
   devuelve ~1 KB.
3. Import dinámico de `recharts` (`next/dynamic`) para sacarlo del bundle
   inicial del dashboard.

### Fase 3 — Cache y data-fetching moderno (impacto: alto, esfuerzo: medio)

1. Introducir **TanStack Query (React Query)** como capa de cache cliente:
   - `staleTime` de 1-5 min para listados y dashboard: navegar ida y vuelta
     deja de re-fetchear todo.
   - Invalidation al crear/editar casos.
   - Reemplaza los `useState`+`useEffect` manuales (menos código, menos bugs).
2. Alternativa más profunda (opcional, evaluar después de 3.1): migrar
   listados y detalle a **Server Components** con fetch en servidor +
   `revalidate`. Mayor reescritura; conviene decidirlo con métricas de la
   Fase 1-2 en mano.

### Fase 4 — Middleware y auth (impacto: medio, esfuerzo: bajo)

1. Cachear el resultado de la whitelist en una **cookie firmada o claim JWT**
   (app_metadata) con TTL corto (ej. 15 min), para no pegar a `allowed_users`
   en cada request. Alternativa simple: solo consultar whitelist en `/login` y
   en rutas de mutación.
2. Index/unique en `allowed_users(email)`.
3. Eliminar el doble chequeo de `AuthGuard` en cliente (el middleware ya
   garantiza sesión); dejar solo el listener de `SIGNED_OUT`. Esto saca el
   spinner bloqueante del primer render.

### Fase 5 — Indexes y payloads (impacto: bajo hoy, blindaje a futuro)

1. Migración SQL con los 4 indexes faltantes de la tabla de §1.9.
2. Reemplazar `select("*")` por listas de columnas en el detalle de caso.
3. Paginación real en servidor (`.range()`) en `/casos` cuando el volumen lo
   justifique (>500 casos), junto con filtros server-side.

### Fase 6 — Rendering (impacto: medio en máquinas lentas)

1. Vista animada: limitar a los ~20-30 casos más recientes (es una vitrina,
   no necesita el dataset completo), con CSS `will-change: transform` y
   `content-visibility: auto` en las cards fuera de viewport.
2. Evaluar virtualización (`@tanstack/react-virtual`) en `/casos` si se
   abandona la paginación.
3. Activar optimización de imágenes de Next (`images.unoptimized: false`) si
   se empiezan a servir fotos/recursos visuales.

### Métricas para validar (antes/después de cada fase)

- Requests a Supabase por carga de página (Network tab): hoy home ≈ N+1.
  Objetivo Fase 1: ≤ 3.
- LCP y TTI de home, `/casos`, `/dashboard` y detalle (Lighthouse).
- Payload transferido por página (KB).

---

## 3. Resumen ejecutivo

| # | Cuello de botella | Severidad | Fix | Fase |
|---|---|---|---|---|
| 1 | N+1 de seguimiento en listados (×3 componentes) | 🔴 | Embed/batch query | 1 |
| 2 | Cascada secuencial en detalle de caso | 🔴 | Promise.all + embeds | 1 |
| 3 | CSR puro sin cache, re-fetch en cada navegación | 🔴 | React Query (→ RSC) | 3 |
| 4 | Middleware: 2 round-trips por request | 🟡 | Cache de whitelist | 4 |
| 5 | Dashboard baja tablas enteras para contar | 🟡 | RPC agregada | 2 |
| 6 | `select("*")` y JSON pesado en payloads | 🟡 | Columnas explícitas | 5 |
| 7 | Vista animada triplica DOM (600 cards) | 🟡 | Limitar dataset | 6 |
| 8 | Indexes faltantes (created_at, allowed_users, etc.) | 🟢 | Migración SQL | 5 |
