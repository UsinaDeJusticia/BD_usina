// Validación de URLs externas cargadas por usuarios (recursos de un caso).
//
// Motivo: `recursos.url` se renderiza en `href`, `window.open`, `<iframe src>`
// e `<img src>`. Sin validar el esquema, una URL `javascript:...` o
// `data:text/html,...` ejecuta código en la sesión de quien la abre (XSS
// almacenado). Sólo permitimos http/https.

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"])

/**
 * Normaliza una URL ingresada por el usuario para guardarla.
 *
 * - "" / null / undefined -> null
 * - Sin esquema ("www.ejemplo.com/nota") -> se antepone "https://"
 * - Esquema http/https -> se devuelve tal cual (trim)
 * - Cualquier otro esquema (javascript:, data:, file:, vbscript:...) -> null
 */
export function normalizeExternalUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const value = String(raw).trim()
  if (!value) return null

  // Única ruta interna válida: el proxy autenticado de archivos.
  if (value.startsWith("/api/files/")) return value
  // Cualquier otra ruta relativa no es un enlace externo válido.
  if (value.startsWith("/") && !value.startsWith("//")) return null

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)
  // "localhost:3000" o "ejemplo.com:8080" parecen tener esquema pero no:
  // si lo que sigue a ":" son dígitos, es un puerto.
  const looksLikeHostPort = /^[^/:]+:\d+(\/|$)/.test(value)
  const candidate = hasScheme && !looksLikeHostPort ? value : `https://${value.replace(/^\/\//, "")}`

  try {
    const parsed = new URL(candidate)
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null
    if (!parsed.hostname) return null
    return candidate
  } catch {
    return null
  }
}

/** true si el valor no está vacío pero no es una URL segura. */
export function isUnsafeExternalUrl(raw: string | null | undefined): boolean {
  if (raw == null || String(raw).trim() === "") return false
  return normalizeExternalUrl(raw) === null
}

/**
 * Versión para renderizar: devuelve una URL segura o `undefined` (para que
 * React no emita el atributo `href`/`src`).
 */
export function safeExternalUrl(raw: string | null | undefined): string | undefined {
  return normalizeExternalUrl(raw) ?? undefined
}

/** `window.open` sólo si la URL es segura, con `noopener`. */
export function openExternalUrl(raw: string | null | undefined): void {
  const url = normalizeExternalUrl(raw)
  if (!url) return
  window.open(url, "_blank", "noopener,noreferrer")
}
