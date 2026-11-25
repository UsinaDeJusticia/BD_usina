// Utilidades puras para las fotos de perfil (testeables sin navegador).

/** Iniciales para cuando no hay foto: "María José Pérez" → "MP". */
export function initials(name: string | null | undefined): string {
  const words = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
  if (words.length === 0) return "?"
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ""
  return (first + last).toLocaleUpperCase("es-AR")
}

/**
 * Tono fijo por persona (siempre el mismo para el mismo nombre). Fondo suave +
 * texto oscuro del mismo tono: contraste ≥ 4.5:1 en todos los casos.
 */
const PALETTE = [
  { bg: "#e0e7ff", fg: "#3730a3" }, // índigo
  { bg: "#ccfbf1", fg: "#115e59" }, // teal
  { bg: "#fde68a", fg: "#78350f" }, // ámbar
  { bg: "#fbcfe8", fg: "#831843" }, // rosa
  { bg: "#dbeafe", fg: "#1e3a8a" }, // azul
  { bg: "#e9d5ff", fg: "#581c87" }, // violeta
  { bg: "#d9f99d", fg: "#365314" }, // lima
  { bg: "#fed7aa", fg: "#7c2d12" }, // naranja
] as const

export function colorFor(name: string | null | undefined) {
  const s = (name ?? "").trim().toLowerCase()
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export interface CropState {
  /** Zoom ≥ 1: 1 = la imagen cubre justo el recuadro. */
  zoom: number
  /** Desplazamiento del centro, en px del recuadro de vista (puede ser negativo). */
  offsetX: number
  offsetY: number
}

/**
 * Dada la imagen natural (w×h), el lado del recuadro cuadrado en pantalla y el
 * estado del recorte, devuelve el rectángulo de la imagen ORIGINAL a recortar
 * (sx, sy, size) y el desplazamiento corregido para que la imagen siempre
 * cubra todo el recuadro (no quedan bordes vacíos).
 */
export function computeCrop(imgW: number, imgH: number, viewSize: number, state: CropState) {
  const zoom = Math.max(1, state.zoom)
  // Escala con la que la imagen "cubre" el recuadro a zoom 1.
  const baseScale = viewSize / Math.min(imgW, imgH)
  const scale = baseScale * zoom
  const dispW = imgW * scale
  const dispH = imgH * scale
  const maxX = Math.max(0, (dispW - viewSize) / 2)
  const maxY = Math.max(0, (dispH - viewSize) / 2)
  const offsetX = Math.min(maxX, Math.max(-maxX, state.offsetX))
  const offsetY = Math.min(maxY, Math.max(-maxY, state.offsetY))
  // Esquina superior izquierda del recuadro, en coordenadas de la imagen mostrada.
  const left = (dispW - viewSize) / 2 - offsetX
  const top = (dispH - viewSize) / 2 - offsetY
  return {
    sx: left / scale,
    sy: top / scale,
    size: viewSize / scale,
    scale,
    offsetX,
    offsetY,
  }
}

export const PROFILE_PHOTO_SIZE = 640
export const PROFILE_PHOTO_PREFIX = "fotos-perfil/"

export function isProfilePhotoPath(path: string | null | undefined): path is string {
  return typeof path === "string" && path.startsWith(PROFILE_PHOTO_PREFIX) && !path.includes("..")
}
