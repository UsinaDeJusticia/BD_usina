# Endurecimiento de seguridad: pasos para producción

Resultado de la auditoría de seguridad de noviembre de 2026. El código ya está
corregido en el repo; estos pasos son los que **sólo se pueden hacer en
Supabase/Vercel** y hay que ejecutarlos a mano, en este orden.

Ninguno de los scripts borra ni modifica filas existentes. Cada uno corre en una
transacción: si algo falla, no se aplica nada.

## 0. Antes de empezar (5 min)

1. Hacer un backup: Supabase → Database → Backups (o `pg_dump`).
2. Confirmar que los emails del equipo están en la whitelist:
   ```sql
   select email from public.allowed_users;
   ```
3. Desplegar primero esta versión del código en Vercel. Funciona con la base
   antes y después de los scripts: si `delete_caso` todavía no existe, el
   botón "Eliminar" usa el borrado anterior.

## 1. Cerrar el acceso anónimo a la base — `scripts/013_harden_rls.sql` (CRÍTICO)

**Problema:** las políticas `USING (true)` dejaban leer, modificar y borrar
todos los datos de víctimas con la anon key, que es pública (va en el JS del
sitio), sin pasar por el login.

1. Correr `scripts/013_harden_rls.sql` en el SQL Editor.
2. Probar la app logueado: listado, detalle, dashboard, crear y editar un caso
   de prueba, subir y ver un archivo.
3. Comprobar que el agujero quedó cerrado (desde cualquier terminal; reemplazar
   URL y anon key):
   ```bash
   curl "https://<proyecto>.supabase.co/rest/v1/victimas?select=id&limit=1" \
     -H "apikey: <anon key>" -H "Authorization: Bearer <anon key>"
   ```
   Antes devolvía datos. Ahora tiene que devolver un error de permisos.

Si algo se rompe: correr `scripts/013_harden_rls_rollback.sql` (restaura las
políticas exactas guardadas en `admin_backup.policies_013`) y avisar.

## 2. Borrado seguro y validaciones — `scripts/015_data_integrity.sql`

- `delete_caso()`: borra el caso sin dejar datos huérfanos, nunca arrastra los
  casos de otras víctimas del mismo hecho y guarda un **snapshot completo**
  en `admin_backup.casos_eliminados`, así un borrado accidental se puede
  recuperar.
- CHECK en `recursos.url`: sólo `http(s)://` o `/api/files/...` (bloquea XSS
  con `javascript:`).
- Bucket `archivos-casos`: límite de 50 MB y tipos permitidos del lado servidor
  (sin SVG).

Después de correrlo, revisar las consultas de diagnóstico del final del script:

- recursos viejos con URLs inválidas,
- víctimas y hechos huérfanos que dejó el borrado anterior.

Esas consultas **sólo leen**. Qué hacer con los huérfanos lo decide el equipo.

## 3. Proteger la edge function de aniversarios — `scripts/014_cron_secret.sql`

**Problema:** la función se podía invocar con la anon key, que es pública:
spam de emails y consumo de cuota de Resend.

Seguir los pasos 1 a 4 del script, **en ese orden**:

1. Crear el secreto en Vault.
2. Que el cron mande el header (inofensivo mientras la función no lo exija).
3. Cargar `CRON_SECRET` en los secrets de la función y desplegar la versión
   nueva (`supabase functions deploy check-anniversaries`).
4. Verificar en `net._http_response` que la siguiente corrida dé 200.

Opcional: `ANNIVERSARY_RECIPIENTS="a@x.org,b@y.org"` para cambiar los
destinatarios sin tocar código.

## 4. Configuración de Supabase Auth (dashboard)

Authentication → Providers / Policies:

- **Password requirements**: mínimo 8 caracteres con minúsculas, mayúsculas y
  dígitos. Hoy sólo lo valida el formulario del navegador.
- **Leaked password protection**: activarla.
- Revisar que los "Redirect URLs" permitidos sean sólo los dominios de la app.

## 5. Vercel

- Agregar `WHITELIST_COOKIE_SECRET` (`openssl rand -hex 32`) si no está.
  Sin él, el middleware consulta la whitelist en cada request: funciona igual,
  pero es más lento.
- Si existe `SUPABASE_SERVICE_ROLE_KEY` en las variables del proyecto, borrarla:
  la app no la usa y es la llave con acceso total.

## 6. CSP: pasar de Report-Only a efectiva (en 1–2 semanas)

`next.config.mjs` envía `Content-Security-Policy-Report-Only`. Con la app
abierta, revisar la consola del navegador (DevTools) en las pantallas
principales. Si no aparecen violaciones, renombrar el header a
`Content-Security-Policy`.

---

## Qué se corrigió en el código (resumen)

| Hallazgo | Corrección |
|---|---|
| RLS abierta | `013` + tests de permisos por rol |
| XSS por `recursos.url` | `lib/url.ts`: sólo http(s), en el guardado, en los enlaces, en `window.open` y en el preview; CHECK en la base |
| Edge function abierta | `CRON_SECRET` (comparación en tiempo constante), sin CORS, HTML escapado, sin detalles de error en la respuesta |
| Sin lockfile, deps en `latest` | Versiones fijas, `package-lock.json` commiteado, 33 dependencias sin uso eliminadas, `npm audit` sin vulnerabilidades |
| Sin CSP | CSP en Report-Only + `poweredByHeader: false` |
| Build ignoraba errores de tipos | 182 errores corregidos; el build vuelve a chequear tipos |
| Uploads sólo validados en el navegador | Límites del bucket (`015`) + rechazo de SVG en el cliente |
| Política de contraseñas sólo en el cliente | Paso 4 de esta guía; mensajes de error genéricos |
| Datos personales en logs | Eliminados del middleware y del listener de auth; ESLint avisa ante `console.log` |
| `/login-*` tratada como pública | Comparación exacta de rutas |
| Código de "usuario mock" | Eliminado |
| Borrado deja huérfanos | `delete_caso()` transaccional con snapshot |
| Guardado no transaccional | `lib/cases/save-case.ts`: cada escritura se verifica, rollback en altas fallidas, restauración de fechas, avisos de errores parciales |
| Componentes gigantes | Guardado y payloads extraídos (`case-form.tsx` pasó de 1414 a ~700 líneas) |
| Migraciones sin registro | `scripts/README.md` + tests de SQL en CI |
| Sin tests ni CI | Vitest (unitarios + integración con Postgres) y GitHub Actions |
