// Tipos de la integración con Mapa del Delito (MdD).
//
// Reflejan `propuestas_para_usina` / `api_propuestas_publicas` en la BD de
// MdD (ver scripts/mapa-del-delito/*.sql y docs/integracion-mapa-del-delito.md).
// No se generan con `supabase gen types` porque ese proyecto todavía está
// pausado (ver H6 en el plan) — actualizar cuando se pueda generar contra
// el schema real.

export interface FuenteNoticia {
  url: string
  titulo: string
  fecha_publicacion?: string | null
  fuente_medio?: string | null
}

export interface PosibleDuplicado {
  usina_victima_id: string
  score: number
}

export interface DuplicadoCheck {
  ejecutado_at?: string | null
  match_score_max?: number | null
  posibles_matches?: PosibleDuplicado[] | null
}

export type EstadoPropuesta = "pendiente" | "aprobada" | "rechazada" | "duplicada"
export type FechaHechoPrecision = "exacta" | "dia_aprox" | "mes_aprox" | "año"

export interface PropuestaCandidata {
  id: string
  nombre_completo: string
  alias: string | null
  edad_aproximada: number | null
  fecha_nacimiento: string | null
  genero: string | null
  nacionalidad: string | null
  fecha_hecho: string | null
  fecha_hecho_precision: FechaHechoPrecision | null
  fecha_fallecimiento: string | null
  provincia: string | null
  municipio: string | null
  tipo_crimen: string | null
  tipo_lugar: string | null
  resumen_corto: string | null
  fuentes: FuenteNoticia[]
  duplicado_check: DuplicadoCheck | null
  confianza_score: number | null
  estado: EstadoPropuesta
  usina_victima_id: string | null
  motivo_rechazo: string | null
  decidido_at: string | null
  decidido_por: string | null
  detectado_at: string
  scrapping_version: string | null
  created_at: string
  updated_at: string
}

export type DecisionCandidato = "aprobada" | "rechazada" | "duplicada"

export interface DecidirCandidatoInput {
  decision: DecisionCandidato
  usina_victima_id?: string | null
  motivo_rechazo?: string | null
}
