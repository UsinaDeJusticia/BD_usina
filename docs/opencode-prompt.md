# Prompt para opencode: aplicar el endurecimiento de seguridad en producción

Copiar desde la línea `---` hasta el final y pegarlo en opencode.

---

Sos responsable de aplicar en PRODUCCIÓN los cambios de seguridad del repo
`UsinaDeJusticia/BD_usina`, rama `claude/youthful-noether-q9j3pn`. El código ya
está hecho y probado (51 tests contra Postgres). Tu tarea es ejecutar los pasos
de infraestructura en Supabase y Vercel, **verificando cada uno**.

## Datos del entorno

- Supabase, proyecto de producción: ref `cvxlbhykhvefufikspsm`.
- Vercel: proyecto `v0-image-analysis` (id `prj_XROpFOTnfvFIaVxC4Vs4J7SyjshR`,
  team `team_ryp3yEKSUnxGMn6kdgWJOiNW`).
- Guía de referencia: `docs/security-hardening.md` (leela entera antes de empezar).

## Reglas obligatorias

1. **Preservar los datos.** Ningún paso puede modificar ni borrar filas de
   datos. Los scripts sólo cambian permisos, políticas, funciones,
   constraints `NOT VALID` y la configuración del bucket.
2. **Backup antes de tocar nada.** Si no podés confirmar que existe un backup
   reciente, frená y avisá.
3. **Una cosa por vez.** Aplicá un paso, verificalo y recién después pasá al
   siguiente. Si una verificación falla, frená, no improvises arreglos y
   reportá el error exacto.
4. **Nada de `force`, `drop table`, `truncate`, `delete` ni `update` sobre
   tablas de datos.** Las consultas de diagnóstico son sólo `select`.
5. **No escribas datos de prueba en producción** (crear o editar casos queda
   para una prueba manual posterior del equipo).
6. **No expongas secretos** en la salida, en logs ni en commits.

## Paso 0: preparación

```bash
git fetch origin claude/youthful-noether-q9j3pn
git checkout claude/youthful-noether-q9j3pn
```

1. Confirmá que existe un backup reciente de la base (Supabase → Database →
   Backups) o generá uno con `pg_dump`. Anotá la fecha y la hora.
2. Guardá los conteos de filas para comparar después:
   ```sql
   select 'victimas' t, count(*) from public.victimas
   union all select 'hechos', count(*) from public.hechos
   union all select 'casos', count(*) from public.casos
   union all select 'imputados', count(*) from public.imputados
   union all select 'instancias_judiciales', count(*) from public.instancias_judiciales
   union all select 'fechas_juicio', count(*) from public.fechas_juicio
   union all select 'seguimiento', count(*) from public.seguimiento
   union all select 'recursos', count(*) from public.recursos
   union all select 'allowed_users', count(*) from public.allowed_users;
   ```
3. Verificá que `allowed_users` tenga los emails del equipo
   (`select email from public.allowed_users;`). Si está vacía, **frená**: la 013
   dejaría a todos sin acceso.
4. Mirá las políticas actuales y anotalas:
   ```sql
   select tablename, policyname, roles, cmd, qual from pg_policies
   where schemaname in ('public','storage') order by 1, 2;
   ```

## Paso 1: `scripts/013_harden_rls.sql` (crítico)

1. Ejecutá el archivo completo tal cual (es una sola transacción).
2. Verificaciones:
   - Conteos idénticos a los del paso 0.
   - `select tablename, policyname, roles from pg_policies where schemaname='public' order by 1;`
     debe mostrar una política `<tabla>_whitelist_all` (rol `authenticated`)
     por tabla de casos, más `allowed_users_select_self`.
   - `select count(*) from admin_backup.policies_013;` debe ser mayor que 0.
   - Acceso anónimo cerrado. Con la anon key (está en Vercel como
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`):
     ```bash
     curl -s "https://cvxlbhykhvefufikspsm.supabase.co/rest/v1/victimas?select=id&limit=1" \
       -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
     ```
     Debe devolver un error de permisos (`42501` o similar), **no** datos.
     Repetí con `allowed_users` y con `rpc/get_dashboard_stats` (POST).
3. Si algo falla o el equipo reporta que la app dejó de funcionar: ejecutá
   `scripts/013_harden_rls_rollback.sql` y reportá.

## Paso 2: `scripts/015_data_integrity.sql`

Requiere el paso 1.

1. Ejecutá el archivo completo.
2. Verificaciones:
   - Conteos idénticos a los del paso 0.
   - `select proname from pg_proc where proname in ('delete_caso','is_allowed_user');` → 2 filas.
   - `select conname, convalidated from pg_constraint where conname='recursos_url_http_check';`
     → 1 fila con `convalidated = false` (es `NOT VALID` a propósito).
   - `select file_size_limit, allowed_mime_types from storage.buckets where id='archivos-casos';`
     → 52428800 y una lista sin `image/svg+xml`.
3. Corré las consultas de diagnóstico del final del script (sólo `select`) y
   **reportá los resultados sin modificar nada**:
   - recursos con URLs no-http,
   - víctimas sin caso,
   - hechos sin caso.

## Paso 3: `scripts/014_cron_secret.sql` (edge function de aniversarios)

Seguí los pasos del script **en este orden exacto** (si invertís el orden, se
pierde el email diario):

1. Generá el secreto con la consulta del paso 1 del script y guardalo en Vault
   como `cron_secret`. No lo imprimas en el reporte.
2. Ejecutá el bloque `do $$ ... $$` del paso 2. Verificá con
   `select command from cron.job where jobname='alerta-aniversarios';` que el
   comando incluya `x-cron-secret`.
3. Cargá el mismo valor como secret `CRON_SECRET` de la edge function y
   desplegala desde la rama:
   ```bash
   supabase secrets set CRON_SECRET=<valor> --project-ref cvxlbhykhvefufikspsm
   supabase functions deploy check-anniversaries --project-ref cvxlbhykhvefufikspsm
   ```
4. Verificaciones:
   - Un POST a la función **sin** el header `x-cron-secret` debe devolver 401.
     Usá la anon key como Bearer. Esto no manda emails.
   - Un GET debe devolver 405.
   - **No** la invoques con el secreto correcto: mandaría el email real. La
     verificación positiva es la próxima corrida del cron (15:00 UTC):
     ```sql
     select status_code, created from net._http_response order by created desc limit 3;
     ```
     → 200. Si da 401, el secreto de Vault y el de la función no coinciden.

## Paso 4: Supabase Auth (dashboard o Management API)

- Password requirements: mínimo 8 caracteres, con minúsculas, mayúsculas y dígitos.
- Leaked password protection: activada.
- Redirect URLs: dejá sólo los dominios de la app (reportá cuáles hay antes de cambiar nada).

## Paso 5: Vercel, borrar secretos que la app no usa

Ya está verificado que el código sólo lee `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` y `WHITELIST_COOKIE_SECRET`. El equipo autorizó
borrar estas 7 variables (en todos los entornos):

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `POSTGRES_PASSWORD`
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`

Con la CLI (`vercel env rm <NOMBRE> <entorno> --yes` para production, preview
y development) o desde Vercel → Project Settings → Environment Variables.

**No borres** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`WHITELIST_COOKIE_SECRET`, `SUPABASE_URL` ni `SUPABASE_ANON_KEY`.

Las crea la integración Supabase–Vercel: avisá si reaparecen. Después de
borrarlas, redeployá el preview de la rama y verificá que `/login` responda
200 y que `/casos` sin sesión termine en `/login`.

## Reporte final

Entregá una tabla con cada paso (0–5): hecho / no hecho, la evidencia de cada
verificación (salidas resumidas, sin secretos), los conteos antes y después,
y los resultados de los diagnósticos del paso 2. Indicá explícitamente
cualquier cosa que no hayas podido hacer y por qué.

Queda pendiente para después, no lo hagas:

- probar crear y editar un caso;
- pasar la CSP de Report-Only a efectiva (dentro de 1–2 semanas);
- decidir qué hacer con los datos huérfanos.
