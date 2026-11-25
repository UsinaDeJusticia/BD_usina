# Migraciones de base de datos

Desde noviembre de 2026 el esquema de la base vive en `supabase/migrations/` y se
aplica automáticamente en producción, con aprobación manual. **Ya no se cambia la
base desde el SQL Editor** (salvo emergencias, ver al final).

`scripts/` queda como historial de lo que se aplicó a mano antes de esto.

## Cómo está armado

| Pieza | Qué hace |
|---|---|
| `supabase/migrations/20261126000000_baseline_produccion.sql` | Foto del esquema de producción al 26/11/2026 (solo estructura, sin datos). Ya está marcada como aplicada en producción. |
| `supabase/migrations/20261126000100_storage_archivos_casos.sql` | Bucket privado y políticas de Storage (el dump no incluye ese esquema). También marcada como aplicada. |
| `lib/types/supabase.ts` | Tipos TypeScript generados desde las migraciones. **No se edita a mano.** |
| CI, job `migrations` | En cada PR levanta una base vacía, aplica todas las migraciones, corre el lint y verifica que los tipos estén al día. |
| `.github/workflows/db-deploy.yml` | Al llegar a `main`, aplica las migraciones nuevas en producción **después de que alguien lo apruebe** en GitHub. |

## Hacer un cambio de base (flujo normal)

Requiere Docker y Node.

```bash
npm run db:start            # levanta Supabase local con todas las migraciones
npm run db:new agregar_x    # crea supabase/migrations/<fecha>_agregar_x.sql
# escribir el SQL en ese archivo
npm run db:reset            # reaplica todo desde cero: si falla, el SQL tiene un error
npm run db:types            # regenera lib/types/supabase.ts
```

Commitear la migración y `lib/types/supabase.ts` en el mismo PR. CI verifica que
apliquen y que los tipos coincidan.

Al mergear, GitHub Actions muestra el job **"Migraciones a producción"**
esperando aprobación. Quien aprueba ve el listado de migraciones pendientes
(`db push --dry-run`) antes de confirmar.

## Reglas

1. **Nunca editar una migración ya aplicada.** Para corregir algo, crear una nueva.
2. **Preservar los datos.** Nada de `drop table`, `drop column` ni `delete` masivos
   en una migración sin un backup previo y la aprobación explícita del equipo.
   Para renombrar, preferir agregar la columna nueva, copiar y dejar la vieja
   hasta confirmar.
3. **Compatibilidad hacia atrás.** El código se despliega en Vercel y la base en
   GitHub Actions: durante unos minutos puede correr el código viejo con la base
   nueva. Las migraciones tienen que ser aditivas (columnas opcionales, tablas
   nuevas) y el código nuevo tiene que tolerar la base vieja si llega antes.
4. **Una migración, una transacción.** El CLI ya envuelve cada archivo en una
   transacción: si algo falla, no se aplica nada.

## Configuración inicial (una sola vez)

En GitHub → Settings del repo:

1. **Environments → New environment → `db-production`:**
   (no usar `Production`/`Preview`: los crea Vercel para sus deploys)
   - Required reviewers: las personas que pueden aprobar cambios de base.
   - Deployment branches: solo `main`.
2. **Secrets → Actions** (en el environment `db-production`):
   - `SUPABASE_ACCESS_TOKEN`: token personal de Supabase (Account → Access Tokens).
   - `SUPABASE_DB_PASSWORD`: contraseña de la base de producción.
3. **Variables → Actions:** `DB_DEPLOY_ENABLED` = `true`.
   Esta variable se activa **último**, después de configurar los revisores. Hasta
   entonces el workflow no corre: es el seguro para que un environment sin
   protección nunca aplique cambios solo.

## Emergencias

Si hay que tocar producción a mano (SQL Editor), después hay que traer el cambio
al repo como migración y marcarla aplicada:

```bash
npx supabase migration repair --status applied <version> --linked
```

Si no, la próxima diferencia entre el repo y producción la detecta
`supabase db diff --linked`.
