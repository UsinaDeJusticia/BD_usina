# Prompt para opencode (3): activar notificaciones y push en producción

Copiar desde la línea `---` hasta el final y pegarlo en opencode.

**Cuándo correrlo:** después de mergear a `main` el PR de PWA y notificaciones.
Se puede correr antes o después del prompt 2 (rotación de llaves). Si ya se
rotaron, usá las llaves nuevas.

---

Vas a activar en PRODUCCIÓN las notificaciones de la base de Usina de Justicia
(repo `UsinaDeJusticia/BD_usina`, rama `main`). El código ya está desplegado y
probado; faltan la base de datos, las funciones de Supabase y una variable de
Vercel. Leé `docs/notificaciones.md` antes de empezar.

## Datos del entorno

- Supabase producción: ref `cvxlbhykhvefufikspsm`.
- Vercel: proyecto `v0-image-analysis` (id `prj_XROpFOTnfvFIaVxC4Vs4J7SyjshR`,
  team `team_ryp3yEKSUnxGMn6kdgWJOiNW`). Dominio `https://www.basedatosuj.org.ar`.

## Reglas obligatorias

1. **Preservar los datos:** ningún `update`, `delete` ni `truncate` sobre tablas
   existentes. `016` solo crea tablas, funciones y un trigger nuevos.
2. **No imprimir secretos:** la clave privada VAPID y `CRON_SECRET` no aparecen
   en la salida, en logs ni en commits. La clave pública VAPID sí se puede
   mostrar.
3. **Una cosa por vez:** verificá cada paso; si algo falla, frená y reportá.
4. No hagas commits ni push.
5. No envíes notificaciones a otros usuarios. Solo se permite la de prueba.

## Paso 0: estado inicial

Contá las filas y guardá el resultado para comparar al final:

```sql
select 'victimas' t, count(*) from public.victimas
union all select 'casos', count(*) from public.casos
union all select 'recursos', count(*) from public.recursos
union all select 'allowed_users', count(*) from public.allowed_users;
```

Confirmá los prerrequisitos:

- `select to_regprocedure('public.is_allowed_user()');` no es null. Lo crea `013`.
- `select count(*) from vault.secrets where name = 'cron_secret';` es 1. Lo crea `014`.
- `select to_regprocedure('net.http_post(text, jsonb, jsonb, jsonb, integer)');`
  no es null. Es la extensión pg_net.

Si falta alguno, frená y reportá.

## Paso 1: base de datos

1. Ejecutá `scripts/016_notifications.sql` completo. Es una sola transacción.
2. Verificá:
   - las tablas `notificaciones`, `notificacion_preferencias` y
     `push_suscripciones` existen con RLS activada;
   - `select tablename, policyname, roles from pg_policies where tablename in ('notificaciones','notificacion_preferencias','push_suscripciones');`
     devuelve todas con rol `authenticated`;
   - con la anon key, `GET /rest/v1/notificaciones?select=id` da 401/42501 y
     `POST /rest/v1/rpc/notificacion_de_prueba` da 401/42501;
   - los conteos del paso 0 no cambiaron.

## Paso 2: claves VAPID

1. Generá un par nuevo **en tu máquina**:
   ```bash
   npx web-push@3.6.7 generate-vapid-keys --json
   ```
2. Cargalo como secrets de las edge functions:
   ```bash
   supabase secrets set --project-ref cvxlbhykhvefufikspsm \
     VAPID_PUBLIC_KEY=<publica> VAPID_PRIVATE_KEY=<privada> \
     VAPID_SUBJECT=mailto:info@usinadejusticia.org.ar
   ```
3. En Vercel, creá `NEXT_PUBLIC_VAPID_PUBLIC_KEY` con la clave **pública**, en
   production, preview y development, de tipo plain o encrypted. No es secreta.
4. Borrá de tu máquina el archivo o la salida con la clave privada.

## Paso 3: edge functions

```bash
supabase functions deploy send-push --project-ref cvxlbhykhvefufikspsm --no-verify-jwt
supabase functions deploy check-anniversaries --project-ref cvxlbhykhvefufikspsm
```

`send-push` usa `--no-verify-jwt` porque la llama pg_net solo con el header
`x-cron-secret`. Sin ese secreto, la función responde 401.

Verificá:

- `GET .../functions/v1/send-push` → 405;
- `POST` sin `x-cron-secret` → 401;
- `POST` con un secreto incorrecto → 401.

## Paso 4: redeploy de producción en Vercel

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` se incrusta en el build, así que redeployá
producción con el último commit de `main`. Esperá a que quede `READY` y
asignado a `www.basedatosuj.org.ar`. Después verificá:

- `/manifest.webmanifest` → 200, `application/manifest+json`, sin sesión;
- `/sw.js` → 200, con `Cache-Control: no-cache, no-store, must-revalidate`;
- `/offline.html` → 200;
- `/login` → 200, y `/casos` sin sesión redirige a `/login`;
- en algún chunk de `/_next/static/` aparece la clave pública VAPID.

## Paso 5: prueba de punta a punta del envío (sin usuarios reales)

1. Insertá una notificación de prueba dirigida a un email que **no** tenga
   dispositivos registrados. Usá uno de `allowed_users`, en minúsculas:
   ```sql
   insert into public.notificaciones (user_email, tipo, titulo, cuerpo, url)
   values ('<email-en-minusculas>', 'prueba', 'Prueba de instalación', 'Verificación del envío push', '/notificaciones')
   returning id;
   ```
   Esto no envía nada a nadie, porque ese usuario todavía no registró
   dispositivos.
2. Unos segundos después:
   ```sql
   select status_code, left(content::text, 200) from net._http_response order by created desc limit 1;
   ```
   Tiene que dar **200** con `{"ok":true,"sent":0,...,"devices":0}`.
   - 401: `CRON_SECRET` de la función y `cron_secret` de Vault no coinciden.
   - 503: faltan los secrets VAPID.
   - 500: revisá los logs de `send-push`.
3. Confirmá que la notificación quedó con `push_enviada_at` no nulo.
4. Borrá **solo esa fila de prueba**, por su id:
   ```sql
   delete from public.notificaciones where id = '<id del paso 1>';
   ```

## Reporte final

Entregá una tabla con los pasos 0 a 5: estado y evidencia resumida, sin
secretos. Incluí:

- la clave pública VAPID;
- el id del deploy de producción;
- los conteos de filas antes y después;
- cualquier cosa que no hayas podido hacer.

La prueba con un dispositivo real la hace el equipo después. Desde
`/notificaciones`: "Activar notificaciones push" y luego "Enviar prueba".
