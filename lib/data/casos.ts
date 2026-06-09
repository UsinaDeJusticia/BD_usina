// Data layer para los listados de casos.
//
// Centraliza la query que arma cada "tarjeta" de caso para `/`, `/casos` y
// la vista animada. Antes cada componente disparaba N+1 queries (una a `casos`
// + una a `seguimiento` por cada caso); ahora es una sola query con embeds.

import type { SupabaseClient } from "@supabase/supabase-js"

export interface CaseListItem {
  id: string
  victimName: string
  incidentDate: string
  municipio: string
  provincia: string
  status: string
  familyContactName: string
  familyRelationship: string
  familyContactPhone: string
  hechoId: string
  totalVictimsInHecho: number
}

const NOT_SPECIFIED = "No especificado"
const DEFAULT_STATUS = "En investigación"

interface ContactoFamiliarMin {
  nombre?: string | null
  parentesco?: string | null
  telefono?: string | null
}

interface SeguimientoMin {
  lista_contactos_familiares: ContactoFamiliarMin[] | null
  created_at: string | null
}

/**
 * Trae todos los casos con la info necesaria para los listados, en una sola
 * query embebida. La transformación a `CaseListItem` se hace en JS (no en
 * SQL) para mantener compatible la lógica con los componentes existentes.
 */
export async function fetchCasesList(
  supabase: SupabaseClient,
): Promise<CaseListItem[]> {
  const { data: casos, error } = await supabase
    .from("casos")
    .select(`
      id,
      estado_general,
      estado,
      hecho_id,
      victima_id,
      created_at,
      victimas (id, nombre_completo),
      hechos (
        id,
        fecha_hecho,
        municipio,
        provincia,
        seguimiento (lista_contactos_familiares, created_at)
      )
    `)
    .order("created_at", { ascending: false })

  if (error) throw error

  // Cantidad de víctimas por hecho — para el badge "N víctimas".
  const hechoVictimCounts: Record<string, number> = {}
  for (const c of (casos ?? []) as any[]) {
    if (c.hecho_id) {
      hechoVictimCounts[c.hecho_id] = (hechoVictimCounts[c.hecho_id] ?? 0) + 1
    }
  }

  return ((casos ?? []) as any[]).map((c): CaseListItem => {
    const victima = c.victimas ?? {}
    const hecho = c.hechos ?? {}

    // El componente original tomaba el seguimiento más viejo
    // (`order created_at asc limit 1`). Lo replicamos en memoria.
    const seguimientos: SeguimientoMin[] = hecho.seguimiento ?? []
    const seguimientoMasViejo = seguimientos
      .slice()
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))[0]
    const primerContacto =
      seguimientoMasViejo?.lista_contactos_familiares?.[0] ?? null

    const familyContactName = primerContacto?.nombre || NOT_SPECIFIED
    const familyRelationship = primerContacto?.parentesco || ""
    const familyContactPhone =
      primerContacto?.telefono?.trim() || NOT_SPECIFIED

    const status =
      c.estado?.trim() || c.estado_general?.trim() || DEFAULT_STATUS

    return {
      id: c.id,
      victimName: victima.nombre_completo || "Sin nombre",
      incidentDate: hecho.fecha_hecho || new Date().toISOString(),
      municipio: hecho.municipio || NOT_SPECIFIED,
      provincia: hecho.provincia || NOT_SPECIFIED,
      status,
      familyContactName,
      familyRelationship,
      familyContactPhone,
      hechoId: c.hecho_id,
      totalVictimsInHecho: c.hecho_id ? hechoVictimCounts[c.hecho_id] : 1,
    }
  })
}
