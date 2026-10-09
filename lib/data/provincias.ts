// Provincias en la ortografía de Georef, la misma que guarda el formulario de casos.
// Coincide con las propiedades `provincia` de public/geo/provincias-ar.geojson.

import type { ProvinceData } from "@/lib/data/dashboard"

export const PROVINCIAS = [
  "Ciudad Autónoma de Buenos Aires",
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego, Antártida e Islas del Atlántico Sur",
  "Tucumán",
] as const

// Nombres cortos para las etiquetas del ranking.
const NOMBRE_CORTO: Record<string, string> = {
  "Ciudad Autónoma de Buenos Aires": "CABA",
  "Tierra del Fuego, Antártida e Islas del Atlántico Sur": "Tierra del Fuego",
}

// Variantes que aparecen en registros anteriores o en otras fuentes.
const VARIANTES: Record<string, string> = {
  caba: "Ciudad Autónoma de Buenos Aires",
  "ciudad de buenos aires": "Ciudad Autónoma de Buenos Aires",
  "ciudad autonoma de buenos aires": "Ciudad Autónoma de Buenos Aires",
  "tierra del fuego": "Tierra del Fuego, Antártida e Islas del Atlántico Sur",
}

// Comparación sin tildes ni mayúsculas, para que "Cordoba" y "Córdoba" coincidan.
const normalizar = (texto: string): string =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()

const CANONICA = new Map<string, string>(PROVINCIAS.map((nombre) => [normalizar(nombre), nombre]))
const VARIANTES_NORMALIZADAS = new Map<string, string>(
  Object.entries(VARIANTES).map(([variante, nombre]) => [normalizar(variante), nombre]),
)

/** Nombre Georef de una provincia, o null si no se reconoce. */
export function canonicalProvincia(raw: string): string | null {
  const clave = normalizar(raw)
  return CANONICA.get(clave) ?? VARIANTES_NORMALIZADAS.get(clave) ?? null
}

export function nombreCorto(canonica: string): string {
  return NOMBRE_CORTO[canonica] ?? canonica
}

/**
 * Une las filas de la RPC por provincia canónica. Las provincias sin nombre
 * reconocible (y el "Sin dato" de la RPC) se devuelven aparte en `sinUbicar`.
 */
export function victimasPorProvincia(rows: readonly ProvinceData[]): {
  porProvincia: Map<string, number>
  sinUbicar: number
} {
  const porProvincia = new Map<string, number>()
  let sinUbicar = 0
  for (const row of rows) {
    const canonica = canonicalProvincia(row.provincia)
    if (canonica) {
      porProvincia.set(canonica, (porProvincia.get(canonica) ?? 0) + row.victimas)
    } else {
      sinUbicar += row.victimas
    }
  }
  return { porProvincia, sinUbicar }
}
