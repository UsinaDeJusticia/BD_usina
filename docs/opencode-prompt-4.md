# Prompt para opencode: esquema base de migraciones

Copiar todo lo que está debajo de la línea y pegarlo en opencode.

---

Necesito que generes el **esquema base** (baseline) de la base de producción de
Usina para pasar a migraciones versionadas con la CLI de Supabase. Proyecto:
`cvxlbhykhvefufikspsm`. Repo: `UsinaDeJusticia/BD_usina`.

**Reglas absolutas:** no modifiques datos ni estructura de producción. Lo único
que escribe en producción es el paso 6 (`migration repair`), que sólo agrega
filas a la tabla de historial `supabase_migrations.schema_migrations`. Si algo
falla o no coincide con lo esperado, **frená y reportá** sin improvisar.

## Pasos

1. Preparar la rama:
   ```bash
   git fetch origin claude/youthful-noether-q9j3pn
   git checkout -b chore/schema-baseline origin/claude/youthful-noether-q9j3pn
   npm ci
   ```

2. Verificar la versión de Postgres de producción:
   ```sql
   select version();
   ```
   Si la versión mayor no es 17, cambiá `major_version` en
   `supabase/config.toml` (sección `[db]`) al número correcto.

3. Vincular el proyecto (pide la contraseña de la base):
   ```bash
   npx supabase link --project-ref cvxlbhykhvefufikspsm
   ```

4. Sacar el esquema (**solo estructura, sin datos**):
   ```bash
   npx supabase db dump --linked --schema public,admin_backup \
     -f supabase/migrations/20261126000000_baseline_produccion.sql
   ```
   Verificá que el archivo **no tenga datos**:
   ```bash
   grep -cE '^(INSERT|COPY) ' supabase/migrations/20261126000000_baseline_produccion.sql
   ```
   Tiene que dar `0`. Si da otra cosa, borrá el archivo y reportá.
   Si el esquema `admin_backup` no existe, repetí el dump solo con `--schema public`.

5. Probar en local que el esquema base + la migración de Storage aplican sobre
   una base vacía (requiere Docker):
   ```bash
   npx supabase start
   npx supabase db reset
   npx supabase db lint --local --level error
   ```
   Si el reset falla, reportá el error completo (no edites el SQL a mano salvo
   que el error sea obvio, como una extensión que falta; en ese caso contame qué
   cambiaste). Después:
   ```bash
   npx supabase stop
   ```

6. Marcar en producción las dos migraciones como ya aplicadas (solo historial,
   no ejecuta SQL):
   ```bash
   npx supabase migration repair --status applied 20261126000000 20261126000100 --linked
   npx supabase migration list --linked
   ```
   En `migration list` las dos versiones tienen que aparecer tanto en Local como
   en Remote.

7. Confirmar que no hay diferencias entre el repo y producción:
   ```bash
   npx supabase db diff --linked --schema public
   ```
   Lo esperado es que no haya diferencias (o solo diferencias triviales de
   permisos/comentarios). Copiá la salida en el reporte.

8. Subir **solo** el archivo del esquema base (y `supabase/config.toml` si lo
   cambiaste en el paso 2):
   ```bash
   git add supabase/migrations/20261126000000_baseline_produccion.sql
   git add supabase/config.toml   # solo si cambió
   git commit -m "chore(db): esquema base de producción para migraciones"
   git push -u origin chore/schema-baseline
   ```
   No subas `supabase/.temp/` ni ningún otro archivo.

## Reporte

Respondeme con:
- Versión de Postgres (paso 2) y si cambiaste `config.toml`.
- Tamaño en líneas del archivo y resultado del `grep` (paso 4).
- Resultado de `db reset` y del lint (paso 5).
- Salida de `migration list` (paso 6).
- Salida de `db diff` (paso 7).
- Hash del commit pusheado.
- Conteos de control para confirmar que no se tocó nada:
  ```sql
  select (select count(*) from victimas) v, (select count(*) from casos) c,
         (select count(*) from recursos) r;
  ```
  (Esperado: 147 / 144 / 126, o más si cargaron datos nuevos.)
