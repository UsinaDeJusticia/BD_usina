# Aplicar `scripts/014_harden_rls.sql`

Cierra el acceso de la `anon key` a las tablas de `public`. Se corre en el
SQL Editor del proyecto Supabase de BD Usina. No se mergea código para que
esto tome efecto: el cambio es sólo esta corrida de SQL.

Correr **únicamente** `scripts/014_harden_rls.sql`.

No correr `scripts/015_api_victimas_publicas.sql` ni ningún script de la
integración con Mapa del Delito. 014 no los necesita. 015 crea una vista
que esa integración iba a leer y hoy está en pausa.

## 1. Respaldo

En el SQL Editor, **antes** de pegar el 014, guardar el resultado completo
de:

```sql
select * from pg_policies where schemaname in ('public', 'storage');
```

Exportarlo (CSV o copiar todas las filas). No alcanza con mirarlo.

Esa consulta no guarda los GRANT ni los privilegios por defecto. Sin esto
otro, el rollback de policies no devuelve los permisos de `anon`.
`information_schema.table_privileges` tampoco sirve como respaldo completo:
sólo muestra grants en los que el rol actual es quien otorga o quien recibe.
Guardar el ACL del catálogo, que es lo que hay que poder reconstruir:

```sql
select n.nspname as schema,
       c.relname as objeto,
       c.relkind as tipo,
       c.relacl::text as acl
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
  and c.relkind in ('r', 'p', 'v', 'm', 'S')
  and c.relacl is not null
order by 1, 2;

select n.nspname as schema,
       p.proname as funcion,
       pg_get_function_identity_arguments(p.oid) as args,
       p.proacl::text as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by 2;

select pg_get_userbyid(d.defaclrole) as rol_creador,
       n.nspname as schema,
       d.defaclobjtype as tipo,
       d.defaclacl::text as acl
from pg_default_acl d
join pg_namespace n on n.oid = d.defaclnamespace
where n.nspname = 'public'
order by 1, 3;
```

`relkind`: `r` tabla, `v` vista, `S` secuencia. `defaclobjtype`: `r` tabla,
`S` secuencia, `f` función. En el ACL, `anon=...` es el rol anon y un
privilegio que empieza con `=` (sin nombre de rol) es PUBLIC.

`defaclobjtype`: `r` tabla, `S` secuencia, `f` función.

Y generar el DDL para recrear las policies actuales. Guardar la columna
`ddl` completa:

```sql
select format(
  'drop policy if exists %I on %I.%I; create policy %I on %I.%I as %s for %s to %s%s%s;',
  policyname, schemaname, tablename,
  policyname, schemaname, tablename,
  lower(permissive),
  lower(cmd),
  array_to_string(roles, ', '),
  case when qual is not null then format(' using (%s)', qual) else '' end,
  case when with_check is not null then format(' with check (%s)', with_check) else '' end
) as ddl
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;
```

014 no modifica policies de `storage`. El respaldo las incluye para poder
comparar después y demostrar que no cambiaron.

## 2. Emails de `allowed_users`

`is_allowed_user()` y la policy de `allowed_users` comparan con `=`, no con
`ilike` ni con `trim`:

```sql
email = auth.email()
```

`auth.email()` es el email del JWT. En los usuarios creados por Supabase
Auth coincide con `auth.users.email`: minúsculas, sin espacios. Si la
whitelist tiene `Nombre@Dominio.com` o un espacio, el middleware puede
haber estado dejando pasar por una coincidencia distinta y, después del
014, **todas** las lecturas y escrituras de esa persona van a volver
vacías o a fallar. Storage también: las policies de `010` hacen
`auth.email() IN (SELECT email FROM allowed_users)` y, con la policy nueva,
esa subconsulta sólo ve la fila cuyo email es exactamente el del JWT.

Estas dos consultas tienen que devolver **cero filas** antes de seguir:

```sql
select email
from public.allowed_users
where email is distinct from lower(btrim(email));

select a.email as allowed_email, u.email as auth_email
from public.allowed_users a
join auth.users u
  on lower(btrim(u.email)) = lower(btrim(a.email))
where a.email is distinct from u.email;
```

La tercera es informativa (gente en la whitelist que todavía no tiene
usuario en Auth). No bloquea el 014; esa persona no va a entrar hasta que
exista un usuario cuyo `auth.users.email` sea idéntico al de la whitelist:

```sql
select a.email as allowed_email
from public.allowed_users a
left join auth.users u on u.email = a.email
where u.id is null
order by a.email;
```

Si las dos primeras devuelven filas, corregir **a mano**, fila por fila,
dejando el email igual a `auth.users.email`. No correr un `UPDATE` masivo
sin mirar el resultado. Recién cuando las dos primeras consultas den cero
filas, aplicar el 014.

## 3. Aplicar sólo el 014

1. Abrir `scripts/014_harden_rls.sql` de esta rama y pegarlo entero en el
   SQL Editor.
2. Ejecutarlo una sola vez. Es idempotente: si se corre de nuevo, deja las
   mismas policies.
3. Si el editor reporta error, **parar**. No improvisar otro script y no
   correr el 015. El SQL Editor de Supabase envuelve la corrida en una
   transacción: un error deja el esquema como estaba.
4. Errores esperables si el proyecto no tiene algo que 014 no crea:
   falta la tabla `allowed_users` o `instancias_judiciales`, o no existen
   los roles `anon` / `authenticated`. En el proyecto actual esas cosas ya
   están. Si faltara alguna, frenar y revisar: no crear una whitelist
   vacía para “hacer pasar” el script.

## 4. Verificación

### 4.1 Policies y grants, en el SQL Editor

```sql
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Todas las filas tienen que decir `roles = {authenticated}`. No tiene que
quedar `{public}` ni un array que incluya `anon`.

```sql
select n.nspname, c.relname, c.relacl::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm', 'S')
  and c.relacl::text ~ '(^|[,{])anon=';
```

Cero filas. Si aparece alguna, el `REVOKE` no alcanzó un grant hecho por
otro rol (ver riesgos más abajo). No seguir a probar la app como si ya
estuviera cerrado.

```sql
select pg_get_userbyid(d.defaclrole) as rol_creador,
       d.defaclobjtype,
       d.defaclacl::text
from pg_default_acl d
join pg_namespace n on n.oid = d.defaclnamespace
where n.nspname = 'public'
  and d.defaclacl::text ilike '%anon%';
```

Lo que ejecuta el SQL Editor (normalmente `postgres`) no tiene que seguir
otorgando nada a `anon`. Si la fila es de **otro** `rol_creador`, los
defaults de ese rol no los cambió el 014. Anotarlo; no hace falta corregirlo
para cerrar las tablas que ya existen, sí para tablas que ese otro rol cree
después.

Storage, comparado contra el respaldo, tiene que ser idéntico:

```sql
select * from pg_policies where schemaname = 'storage' order by tablename, policyname;
```

### 4.2 anon key, sin sesión

La anon key es la pública del proyecto (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).
No usar la service role.

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  "https://<ref>.supabase.co/rest/v1/victimas?select=id&limit=1" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Accept: application/json"
```

Resultado válido: HTTP 401 o 403 (permiso denegado), o HTTP 200 con `[]`.
Resultado inválido: un array con objetos. Si pasa eso, cortar y hacer el
rollback de la sección 5 antes de seguir probando.

Repetir el mismo curl **sin** el header `Authorization`, sólo con `apikey`.
Mismo criterio.

### 4.3 App, con un usuario de la whitelist

Usar una ventana de incógnito (la cookie `usina_wl` cachea el chequeo del
middleware 15 minutos; incógnito fuerza el chequeo de nuevo). El dato igual
pasa por RLS aunque la cookie exista: si el email no coincide, los listados
se ven vacíos.

1. **Login.** Entrar con un email que esté en `allowed_users` y en
   `auth.users` con el mismo string. Tiene que ir a `/`, no a
   `/no-autorizado`.
2. **Listados.** Abrir `/casos`. Tienen que verse los casos de siempre, no
   una lista vacía.
3. **Guardado de fichas.** Abrir una ficha existente, cambiar un campo
   reversible (por ejemplo una nota), guardar, recargar y confirmar que el
   cambio está. Después volver el campo atrás y guardar de nuevo.
4. **Dashboard.** Abrir `/dashboard`. Los números y los gráficos tienen que
   cargar. Esa pantalla llama a `get_dashboard_stats()` con el usuario
   autenticado; `anon` ya no puede ejecutarla.
5. **Archivos.** En una ficha que tenga adjunto, abrirlo. Tiene que
   descargar o mostrarse vía `/api/files/...`. Un 403 con el usuario
   whitelisted indica que el email no coincide con `auth.email()` (la
   policy de storage de `010` quedó igual, pero ahora la subconsulta a
   `allowed_users` sólo ve la fila propia).
6. **Cron de aniversarios.** 014 no modifica el job ni la edge function.
   Confirmar que el job sigue activo y con el mismo comando que antes:

   ```sql
   select jobid, jobname, schedule, active, command
   from cron.job
   where jobname = 'alerta-aniversarios';
   ```

   `active` tiene que seguir en true. No correr `cron.schedule` ni
   `cron.alter_job`.

   La función lee `victimas` con la service role, que ignora RLS, así que
   el 014 no le saca datos. El cron sólo usa la anon key como Bearer para
   pasar `verify_jwt` de la edge function; eso no consulta PostgREST.

   No hace falta dispararla a mano. Un disparo manual puede mandar el mail
   real de aniversarios si mañana hay una fecha cargada. Al día siguiente,
   después de las 15:00 UTC (12:00 AR), revisar:

   ```sql
   select jobid, status, return_message, start_time
   from cron.job_run_details
   where jobid = <JOBID>
   order by start_time desc
   limit 5;
   ```

   `status` esperado: `succeeded`. Si se necesita una prueba el mismo día y
   se acepta ese mail, se puede invocar la URL que ya está en
   `scripts/009_schedule_check_anniversaries.sql` con el mismo Bearer. Si
   no, esperar a la corrida programada.

## 5. Rollback desde el respaldo

Esto vuelve a dejar las tablas de `public` abiertas para la anon key, que
es el estado anterior. Hacerlo sólo si la verificación de la sección 4
falla y hay que restaurar la app ya.

Orden:

1. Borrar las policies que creó el 014:

   ```sql
   drop policy if exists victimas_whitelist_all on public.victimas;
   drop policy if exists hechos_whitelist_all on public.hechos;
   drop policy if exists imputados_whitelist_all on public.imputados;
   drop policy if exists fechas_juicio_whitelist_all on public.fechas_juicio;
   drop policy if exists seguimiento_whitelist_all on public.seguimiento;
   drop policy if exists recursos_whitelist_all on public.recursos;
   drop policy if exists casos_whitelist_all on public.casos;
   drop policy if exists instancias_judiciales_whitelist_all on public.instancias_judiciales;
   drop policy if exists allowed_users_select_own on public.allowed_users;
   ```

2. Pegar y ejecutar la columna `ddl` guardada en la sección 1 (policies de
   `public` y de `storage`). Eso recrea cada policy con el mismo nombre,
   comando, roles, `USING` y `WITH CHECK` que había antes.

3. Devolver los GRANT de `anon` según el `relacl` / `proacl` guardados. Si
   ese respaldo muestra que `anon` tenía todos los privilegios sobre las
   tablas de `public` (el default de Supabase: `anon=arwdDxt/...`), alcanza
   con:

   ```sql
   grant all on all tables in schema public to anon;
   grant all on all sequences in schema public to anon;
   grant execute on function public.get_dashboard_stats() to anon, public;
   ```

   El `GRANT ... TO public` repone el `EXECUTE` implícito (`=X` en el ACL)
   que el 014 le saca a `get_dashboard_stats`. Sin eso, la anon key sigue
   sin poder llamar la RPC aunque se le devuelva el grant directo.

   Si el respaldo muestra un conjunto más chico, no usar `ALL`: volver a
   otorgar sólo lo que estaba anotado.

4. Devolver los privilegios por defecto del rol con el que se corrió el
   014, sólo si en el respaldo de `pg_default_acl` ese rol le otorgaba
   objetos nuevos a `anon`:

   ```sql
   alter default privileges in schema public grant all on tables to anon;
   alter default privileges in schema public grant all on sequences to anon;
   alter default privileges in schema public grant all on functions to anon;
   ```

5. La función ya no la usa ninguna policy vieja:

   ```sql
   drop function if exists public.is_allowed_user();
   ```

6. Repetir el curl de la sección 4.2. Tiene que volver a devolver datos.
   Confirmar login, un listado y una ficha. Comparar
   `pg_policies` de `storage` contra el respaldo: tiene que seguir igual.

No ejecutar el 015 en ningún punto de este procedimiento.

## 6. Riesgos al aplicar

- **Email distinto al JWT.** Con una sola fila mal escrita se vacían
  listados, fallan los guardados y los adjuntos devuelven 403 para esa
  persona. El chequeo de la sección 2 es el que lo evita.
- **`ALTER DEFAULT PRIVILEGES` sin `FOR ROLE`.** Sólo cambia los defaults
  del rol que corre el script. Si otro rol (por ejemplo `supabase_admin`)
  tiene sus propios defaults con `anon`, las tablas que cree ese rol siguen
  naciendo con grant para `anon`. La consulta de la sección 4.1 lo muestra.
  Los grants que ya existen sí los cubre el `REVOKE ALL` de la sección 5 del
  script, siempre que el rol que ejecuta sea el que los otorgó o un
  superuser. Un grant otorgado por otro rol no se va con este `REVOKE` y
  aparece en la consulta de `relacl`.
- **Funciones nuevas y PUBLIC.** Postgres otorga `EXECUTE` a PUBLIC en cada
  función nueva. El `REVOKE` de defaults contra `anon` no saca ese privilegio
  implícito. `anon` puede ejecutar una función creada después si no se le
  hace `REVOKE FROM public`. El 014 sí lo hace en `is_allowed_user` y, si
  existe, en `get_dashboard_stats`. No lo hace sobre el resto de las
  funciones que ya estén en el proyecto: si hay otra RPC otorgada a PUBLIC,
  la anon key sigue pudiendo llamarla. Las tablas y secuencias nuevas no
  tienen ese default de PUBLIC; ahí el cambio sí deja a `anon` afuera.
- **`FORCE ROW LEVEL SECURITY` en `allowed_users`.** No activarlo. La función
  es `SECURITY DEFINER` y lee la whitelist porque su owner es dueño de la
  tabla y, sin FORCE, el dueño salta el RLS. Con FORCE, la policy es sólo
  `TO authenticated`, el owner no califica, la función devuelve false para
  todo el mundo y la app queda vacía.
- **015.** Crear `api_victimas_publicas` ahora deja una vista con nombres,
  edades y fechas en `public` antes de que exista el rol que debería leerla.
  El `REVOKE` del 015 le saca anon, authenticated y public, pero no hace
  falta crearla para cerrar el agujero del 014.
