-- =============================================================================
-- Endurecimiento del Storage: bucket privado + RLS con whitelist
-- =============================================================================
-- Aplicado el 2026-05-26. Documenta lo que ya está en producción.
--
-- ANTES:
--   - Bucket `archivos-casos` marcado public=true → URLs accesibles SIN AUTH.
--   - Policies de storage.objects exigian solo `authenticated`, sin chequear
--     que el email estuviera en `allowed_users`.
--   - El frontend usaba `getPublicUrl()` que genera URLs permanentes.
--
-- DESPUES:
--   - Bucket privado.
--   - Policies exigen `authenticated` Y email en `allowed_users`.
--   - El frontend pasa por la API route `/api/files/[...path]` que valida
--     sesion + whitelist y redirige a un signed URL de 60s.
-- -----------------------------------------------------------------------------

-- 1. Bucket a privado.
UPDATE storage.buckets SET public = false WHERE id = 'archivos-casos';

-- 2. Borrar policies viejas (nombres autogenerados por el dashboard).
DROP POLICY IF EXISTS "Permitir acceso a usuarios autenticados 1tiomz7_0" ON storage.objects;
DROP POLICY IF EXISTS "Permitir acceso a usuarios autenticados 1tiomz7_1" ON storage.objects;
DROP POLICY IF EXISTS "Permitir acceso a usuarios autenticados 1tiomz7_2" ON storage.objects;
DROP POLICY IF EXISTS "Permitir acceso a usuarios autenticados 1tiomz7_3" ON storage.objects;

-- 3. Policies nuevas: authenticated + bucket-id + whitelist.
-- Patrón consistente con las policies de las tablas en public.*.

CREATE POLICY "archivos_casos_select_whitelist" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'archivos-casos'
    AND (SELECT auth.email()) IN (SELECT email FROM public.allowed_users)
  );

CREATE POLICY "archivos_casos_insert_whitelist" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'archivos-casos'
    AND (SELECT auth.email()) IN (SELECT email FROM public.allowed_users)
  );

CREATE POLICY "archivos_casos_update_whitelist" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'archivos-casos'
    AND (SELECT auth.email()) IN (SELECT email FROM public.allowed_users)
  )
  WITH CHECK (
    bucket_id = 'archivos-casos'
    AND (SELECT auth.email()) IN (SELECT email FROM public.allowed_users)
  );

CREATE POLICY "archivos_casos_delete_whitelist" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'archivos-casos'
    AND (SELECT auth.email()) IN (SELECT email FROM public.allowed_users)
  );

-- 4. Verificación esperada:
--   SELECT id, public FROM storage.buckets WHERE id = 'archivos-casos';
--   -> public = false
--
--   SELECT policyname, cmd, roles FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--   ORDER BY policyname;
--   -> 4 policies con prefijo archivos_casos_*_whitelist, todas TO {authenticated}.
