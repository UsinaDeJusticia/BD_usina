# Prompt para opencode (2): verificar el cron y rotar las llaves de Supabase

Copiar desde la línea `---` hasta el final y pegarlo en opencode.

**Cuándo correrlo:** después del 23/11/2026 a las 15:05 UTC (12:05 en Argentina),
para que la Parte A tenga la corrida del cron que hay que verificar. Elegir un
horario de poco uso: la Parte B **cierra la sesión de todos los usuarios** y
deja la app sin poder leer datos unos minutos, hasta que termina el redeploy.

---

Vas a hacer dos tareas en producción para el repo `UsinaDeJusticia/BD_usina`
(rama `main`). La primera es solo de lectura. La segunda rota credenciales y
tiene un orden estricto.

## Datos del entorno

- Supabase, proyecto de producción: ref `cvxlbhykhvefufikspsm`.
- Vercel: proyecto `v0-image-analysis` (id `prj_XROpFOTnfvFIaVxC4Vs4J7SyjshR`,
  team `team_ryp3yEKSUnxGMn6kdgWJOiNW`). Dominio: `https://www.basedatosuj.org.ar`.
- Contexto: `docs/security-hardening.md` y `scripts/014_cron_secret.sql`.

## Reglas obligatorias

1. **No modificar ni borrar filas de datos.** Ningún `insert`, `update`,
   `delete` ni `truncate` sobre tablas de `public`. Las consultas de
   verificación son solo `select`.
2. **No invocar la edge function `check-anniversaries` con el secreto
   correcto**: mandaría el email real.
3. **No imprimir secretos** (llaves, JWT, contraseñas) en la salida, en logs
   ni en commits. Para comparar valores usá hashes (SHA-256) o los primeros y
   últimos 4 caracteres.
4. **Una cosa por vez.** Si una verificación falla, frená y reportá el error
   exacto. No improvises arreglos.
5. No hagas commits ni push.

## Parte A: confirmar el cron de aniversarios (solo lectura)

1. Corridas recientes del job:
   ```sql
   select jobid, status, return_message, start_time
   from cron.job_run_details
   where jobid = (select jobid from cron.job where jobname = 'alerta-aniversarios')
   order by start_time desc limit 5;
   ```
2. Respuestas HTTP recientes:
   ```sql
   select id, status_code, created, left(content::text, 120) as content
   from net._http_response order by created desc limit 5;
   ```
3. Criterio:
   - Una corrida posterior al 22/11 con `status = 'succeeded'` y una respuesta
     **200** → OK.
   - **401** → el secreto `cron_secret` de Vault y `CRON_SECRET` de la función
     no coinciden. Compará los SHA-256 de ambos, sin imprimirlos, y reportá.
     No cambies nada.
   - **500** → revisá los logs de la función en el dashboard de Supabase
     (Edge Functions → check-anniversaries → Logs) y reportá el error.
4. Si respondió 200 y el body dice `"No anniversaries tomorrow"`, también está
   bien: el cron y la autenticación funcionan aunque ese día no hubiera fechas.

**Si la Parte A no da 200, frená y no hagas la Parte B.**

## Parte B: rotar el JWT secret (invalida las llaves anon y service_role)

Por qué: la `service_role` key y el `JWT secret` estuvieron guardados en
Vercel como variables legibles hasta el 22/11, así que hay que asumir que
pueden haberse copiado. Rotar el JWT secret invalida esas dos llaves y la anon
key vieja, y obliga a todos los usuarios a volver a loguearse.

### B0. Antes de rotar

1. Leé la documentación actual de Supabase sobre rotación de llaves
   (dashboard → Settings → API / JWT Keys) y **reportá qué mecanismo ofrece
   este proyecto**:
   - "Generate a new JWT secret" (legacy, symmetric);
   - JWT signing keys asimétricas con rotación;
   - API keys nuevas (`sb_publishable_...` / `sb_secret_...`).
   Si el proyecto ya usa API keys nuevas o signing keys, **frená y reportá**:
   el procedimiento cambia y lo decide el equipo.
2. Anotá dónde se usa la anon key, porque todos esos lugares hay que
   actualizarlos:
   - Vercel: `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_ANON_KEY` (todos los
     entornos);
   - Vault: secreto `cron_anon_key` (lo usa pg_cron como Bearer para llamar a
     la edge function);
   - cualquier otro lugar que encuentres: buscá en el repo con
     `grep -rn "ANON_KEY" --include=*.ts --include=*.tsx --include=*.sql .`
     y en `vault.secrets` con `select name from vault.secrets;`.
3. La edge function recibe `SUPABASE_SERVICE_ROLE_KEY` inyectada por
   Supabase: no hay que cargarla a mano, pero hay que verificarla después.

### B1. Rotar

1. Rotá el JWT secret desde el dashboard (Settings → API → JWT Settings →
   Generate new secret) o por la Management API.
2. Obtené las **nuevas** anon y service_role keys. No las imprimas.

### B2. Actualizar, en este orden y sin pausas

1. **Vercel:** actualizá `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_ANON_KEY`
   en production, preview y development con la nueva anon key.
2. **Redeploy de producción** del último commit de `main`. Es obligatorio:
   `NEXT_PUBLIC_*` se incrusta en el build, así que actualizar la variable sola
   no alcanza. Esperá a que el deploy quede `READY` y asignado a
   `www.basedatosuj.org.ar`.
3. **Vault:** actualizá `cron_anon_key` con la nueva anon key:
   ```sql
   select vault.update_secret(
     (select id from vault.secrets where name = 'cron_anon_key'),
     '<NUEVA_ANON_KEY>'
   );
   ```
4. **Edge function:** redesplegala para que tome la service_role nueva:
   ```bash
   supabase functions deploy check-anniversaries --project-ref cvxlbhykhvefufikspsm
   ```
   No toques `CRON_SECRET`: no depende del JWT secret.

### B3. Verificar

1. **Llave vieja inválida.** Con la anon key anterior (guardada en memoria
   antes de rotar):
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" \
     "https://cvxlbhykhvefufikspsm.supabase.co/rest/v1/victimas?select=id&limit=1" \
     -H "apikey: $OLD_ANON" -H "Authorization: Bearer $OLD_ANON"
   ```
   Tiene que dar **401** por JWT inválido. Repetí con la service_role vieja:
   también **401**.
2. **Llave nueva con RLS intacta.** La misma consulta con la nueva anon key
   tiene que dar **401 / 42501 "permission denied"**: la llave es válida, pero
   el rol anónimo sigue sin acceso. Repetí con `allowed_users` y con
   `POST /rpc/get_dashboard_stats`.
3. **App en producción.**
   - `https://www.basedatosuj.org.ar/login` → 200.
   - `/casos` sin sesión → redirige a `/login`.
   - Confirmá que el JS servido contiene la anon key nueva y no la vieja:
     buscá el prefijo y el sufijo de 4 caracteres de cada una en los chunks de
     `/_next/static/`.
4. **Edge function.** `POST` sin `x-cron-secret` → 401. `GET` → 405.
5. **Cron.** La confirmación definitiva es la siguiente corrida (15:00 UTC del
   día siguiente): repetí la Parte A. Si da 401 por "Invalid JWT", el Bearer
   que manda el cron (`cron_anon_key`) sigue siendo el viejo.
6. **Conteos de filas** iguales antes y después (deberían serlo: nada de esto
   toca datos):
   ```sql
   select 'victimas' t, count(*) from public.victimas
   union all select 'casos', count(*) from public.casos
   union all select 'recursos', count(*) from public.recursos
   union all select 'allowed_users', count(*) from public.allowed_users;
   ```

### Si algo sale mal

- **La app no carga datos después del redeploy:** casi seguro el build sigue
  con la anon key vieja. Revisá que la variable de Vercel tenga la nueva y
  redeployá. No vuelvas atrás la rotación: el JWT secret viejo no se puede
  recuperar.
- **El cron da 401 "Invalid JWT":** `cron_anon_key` en Vault no se actualizó.
- **La edge function da 500:** revisá sus logs; probablemente no se
  redesplegó.

## Reporte final

Entregá una tabla con A, B0, B1, B2 y B3: estado (hecho / no hecho /
bloqueado) y evidencia resumida, sin secretos. Incluí:

- qué mecanismo de llaves usa el proyecto;
- la lista de lugares donde actualizaste la anon key;
- el id del deploy de producción nuevo;
- los conteos de filas antes y después;
- cualquier cosa que no hayas podido hacer y por qué.
