// Subida y descarga de fotos de perfil (bucket privado archivos-casos).

import type { SupabaseClient } from "@supabase/supabase-js"
import { PROFILE_PHOTO_PREFIX } from "./utils"

const BUCKET = "archivos-casos"

/** Sube la foto ya recortada y devuelve su ruta (fotos-perfil/<uuid>.jpg). */
export async function uploadProfilePhoto(supabase: SupabaseClient, blob: Blob): Promise<string> {
  const path = `${PROFILE_PHOTO_PREFIX}${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    cacheControl: "3600",
    upsert: false,
  })
  if (error) throw error
  return path
}

/**
 * Descarga una imagen del bucket con la sesión del usuario (RLS de Storage).
 * Se usa para recortar una foto que ya está en los recursos: al bajarla como
 * blob no hay problemas de CORS al dibujarla en el canvas.
 */
export async function downloadStorageImage(supabase: SupabaseClient, path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !data) throw error ?? new Error("No se pudo descargar la imagen")
  return data
}

/** Links firmados (1 h) para varias fotos en un solo request. */
export async function signPhotoUrls(
  supabase: SupabaseClient,
  paths: string[],
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)))
  if (unique.length === 0) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unique, 60 * 60)
  if (error) throw error
  const out: Record<string, string> = {}
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) out[item.path] = item.signedUrl
  }
  return out
}
