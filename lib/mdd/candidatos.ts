import type { SupabaseClient } from "@supabase/supabase-js"
import { getMddClient } from "@/lib/mdd/client"
import type { DecidirCandidatoInput, PropuestaCandidata } from "@/lib/mdd/types"

export async function fetchCandidatosPendientes(): Promise<PropuestaCandidata[]> {
  const { data, error } = await getMddClient()
    .from("api_propuestas_publicas")
    .select("*")
    .order("detectado_at", { ascending: false })

  if (error) throw new Error(`Error leyendo propuestas de MdD: ${error.message}`)
  return (data ?? []) as PropuestaCandidata[]
}

export async function fetchCandidatoById(id: string): Promise<PropuestaCandidata | null> {
  const { data, error } = await getMddClient()
    .from("api_propuestas_publicas")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(`Error leyendo propuesta ${id} de MdD: ${error.message}`)
  return (data as PropuestaCandidata | null) ?? null
}

interface DecidirResult {
  callbackOk: boolean
  callbackError?: string
}

/**
 * Aplica la decisión (aprobar/rechazar/marcar duplicado) contra la tabla
 * base de MdD. Va contra `propuestas_para_usina` directo (no la vista
 * `api_propuestas_publicas`, que sólo expone `estado='pendiente'` — un
 * UPDATE que saca la fila de ese filtro no debe fallar por eso, ver nota
 * en scripts/mapa-del-delito/002_api_propuestas_publicas.sql).
 *
 * No lanza si el UPDATE remoto falla: devuelve `callbackOk: false` para
 * que el caller decida encolar el reintento. La decisión LOCAL (ficha
 * creada, log de auditoría) no depende de que MdD esté disponible.
 */
export async function aplicarDecisionEnMdd(
  candidatoId: string,
  input: DecidirCandidatoInput,
  decididoPor: string,
): Promise<DecidirResult> {
  const payload = buildPayload(input, decididoPor)

  try {
    const { error } = await getMddClient()
      .from("propuestas_para_usina")
      .update(payload)
      .eq("id", candidatoId)

    if (error) return { callbackOk: false, callbackError: error.message }
    return { callbackOk: true }
  } catch (err) {
    return {
      callbackOk: false,
      callbackError: err instanceof Error ? err.message : "Error desconocido",
    }
  }
}

export function buildPayload(input: DecidirCandidatoInput, decididoPor: string) {
  return {
    estado: input.decision,
    usina_victima_id: input.usina_victima_id ?? null,
    motivo_rechazo: input.motivo_rechazo ?? null,
    decidido_at: new Date().toISOString(),
    decidido_por: decididoPor,
  }
}

/** Encola el callback fallido para que el cron lo reintente. */
export async function encolarCallbackPendiente(
  supabase: SupabaseClient,
  candidatoId: string,
  payload: Record<string, unknown>,
  ultimoError: string,
): Promise<void> {
  const { error } = await supabase.from("pending_callbacks_mdd").insert({
    candidato_id: candidatoId,
    payload,
    intentos: 1,
    ultimo_error: ultimoError,
  })
  if (error) {
    console.error("No se pudo encolar el callback pendiente para MdD:", error.message)
  }
}

/** Registra la decisión en el log de auditoría de BD Usina. */
export async function registrarDecision(
  supabase: SupabaseClient,
  params: {
    candidatoId: string
    decision: DecidirCandidatoInput["decision"]
    usinaVictimaId: string | null
    motivoRechazo: string | null
    decididoPor: string
    callbackOk: boolean
  },
): Promise<void> {
  const { error } = await supabase.from("revisiones_candidatos_log").insert({
    candidato_id: params.candidatoId,
    decision: params.decision,
    usina_victima_id: params.usinaVictimaId,
    motivo_rechazo: params.motivoRechazo,
    decidido_por: params.decididoPor,
    callback_ok: params.callbackOk,
  })
  if (error) {
    console.error("No se pudo escribir el log de auditoría de candidatos:", error.message)
  }
}
