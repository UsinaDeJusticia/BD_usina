# Scripts SQL (histórico)

> **Desde el 26/11/2026 los cambios de base van en `supabase/migrations/`**
> (ver `docs/migraciones.md`). No agregues scripts nuevos acá: esta carpeta
> queda como registro de lo que se aplicó a mano antes de las migraciones.
> El esquema base (`20261126000000_baseline_produccion.sql`) ya incluye todo lo
> de esta tabla que figura como aplicado.

Los scripts se ejecutaban **a mano** en el SQL Editor de Supabase, en orden.

| Script | Qué hace | Estado en producción |
|---|---|---|
| `001_create_tables.sql` | Tablas base + RLS abierta (`USING (true)`) | Aplicado |
| `001-add-estado-column.sql` | Columna `casos.estado` (numeración duplicada histórica) | Aplicado |
| `002_add_prision_perpetua.sql` | Columna `imputados.prision_perpetua` | Aplicado |
| `003_setup_storage_instructions.sql` | Instrucciones viejas del bucket. **Obsoleto**: lo reemplaza `010` | — |
| `004`–`006` | No existen en el repo (se aplicaron desde v0 / dashboard) | — |
| `007_add_instancias_judiciales_rls.sql` | RLS abierta en `instancias_judiciales` | Aplicado |
| `008_add_otra_intervencion_seguimiento.sql` | Columnas de "otra intervención" | Aplicado |
| `009_schedule_check_anniversaries.sql` | Documenta el cron del email de aniversarios | Aplicado |
| `010_secure_storage.sql` | Bucket privado + policies con whitelist | Aplicado (2026-05-26) |
| `011_dashboard_rpc.sql` | RPC `get_dashboard_stats` | Aplicado |
| `012_performance_indexes.sql` | Índices | Aplicado |
| `013_harden_rls.sql` | RLS con whitelist en todas las tablas (cierra el acceso anónimo) | Aplicado (2026-11-22). Producción ya tenía una variante con whitelist; el backup/rollback restaura esa variante |
| `013_harden_rls_rollback.sql` | Vuelve atrás `013` (sólo emergencias) | — |
| `014_cron_secret.sql` | Secreto compartido cron → edge function | Aplicado (2026-11-22); confirmar la corrida del 23/11 15:00 UTC |
| `015_data_integrity.sql` | `delete_caso()` con snapshot, CHECK de URLs, límites del bucket | Aplicado (2026-11-22) |
| `016_notifications.sql` | Notificaciones en la app + Web Push (tablas, RPCs, trigger hacia `send-push`) | **Pendiente** (ver `docs/opencode-prompt-3.md`) |
| `017_victim_photo.sql` | Columna `victimas.foto_path` (foto de perfil). Aditiva: se puede aplicar antes o después del deploy | Aplicado (2026-11-25) |

Los pasos completos y el orden recomendado están en `docs/security-hardening.md`.

## Cómo se prueban

Ya no se prueban estos scripts: los tests aplican las migraciones de
`supabase/migrations` (ver `docs/migraciones.md`, sección Tests).
