import type { SupabaseClient } from "@supabase/supabase-js"

const BUCKET_NAME = "archivos-casos"

export interface UploadResult {
  success: boolean
  path?: string
  url?: string
  error?: string
}

export async function uploadFile(supabase: SupabaseClient, file: File, folder = "general"): Promise<UploadResult> {
  console.log("[v0] uploadFile - Starting upload:", {
    fileName: file.name,
    fileSize: file.size,
    folder,
    bucket: BUCKET_NAME,
  })

  // Generate unique file name
  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
  const filePath = `${folder}/${timestamp}_${sanitizedName}`

  console.log("[v0] uploadFile - File path:", filePath)

  const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  })

  if (error) {
    console.error("[v0] uploadFile - Upload error:", {
      message: error.message,
      name: error.name,
      cause: error.cause,
      fullError: JSON.stringify(error),
    })
    return { success: false, error: error.message }
  }

  console.log("[v0] uploadFile - Upload successful:", data)

  // El bucket es privado. Devolvemos la URL del proxy autenticado en /api/files
  // (ver app/api/files/[...path]/route.ts). Esa ruta valida sesion + whitelist
  // y redirecciona a un signed URL efímero.
  return {
    success: true,
    path: data.path,
    url: buildApiFileUrl(data.path),
  }
}

export async function deleteFile(supabase: SupabaseClient, filePath: string): Promise<boolean> {
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath])

  if (error) {
    console.error("Delete error:", error)
    return false
  }

  return true
}

/**
 * URL para abrir/descargar un archivo del bucket privado.
 *
 * Apunta a la API route `/api/files/[...path]` que valida sesion + whitelist
 * antes de redirigir a un signed URL de 60s. NO devuelve la URL pública del
 * bucket (que ya no es pública).
 *
 * El parametro `supabase` queda por compatibilidad con call sites existentes;
 * no se usa porque la generacion del URL es estática.
 */
export function getFileUrl(_supabase: SupabaseClient, filePath: string): string {
  return buildApiFileUrl(filePath)
}

/**
 * Versión sin cliente Supabase (para usar en Server Components o en handlers
 * donde no hay cliente disponible). Mismo destino que getFileUrl.
 */
export function getPublicFileUrl(filePath: string): string {
  return buildApiFileUrl(filePath)
}

function buildApiFileUrl(filePath: string): string {
  const encoded = filePath.split("/").map(encodeURIComponent).join("/")
  return `/api/files/${encoded}`
}

export function getFileTypeIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"
  if (mimeType === "application/pdf") return "pdf"
  if (mimeType.includes("word") || mimeType.includes("document")) return "document"
  return "file"
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}
