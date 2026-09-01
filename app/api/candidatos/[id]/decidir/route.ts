import { NextResponse, type NextRequest } from "next/server"
import { requireAuthorizedSession } from "@/lib/auth/require-authorized-session"
import {
  aplicarDecisionEnMdd,
  encolarCallbackPendiente,
  registrarDecision,
} from "@/lib/mdd/candidatos"
import type { DecidirCandidatoInput } from "@/lib/mdd/types"

const DECISIONES_VALIDAS = ["aprobada", "rechazada", "duplicada"] as const

/**
 * Aplica la decisión de revisión de un candidato:
 *   1. UPDATE inmediato en la tabla base de MdD (estado + columnas de
 *      decisión). Ver lib/mdd/candidatos.ts para por qué va contra la
 *      tabla y no la vista.
 *   2. Log de auditoría en BD Usina (revisiones_candidatos_log),
 *      siempre — pase o no el paso 1.
 *   3. Si el paso 1 falló, se encola en pending_callbacks_mdd para que
 *      el cron (`/api/cron/retry-mdd-callbacks`) lo reintente. La
 *      decisión LOCAL nunca se pierde por una falla de red hacia MdD.
 *
 * El caller (UI de /candidatos o el flujo de aprobación en case-form)
 * es responsable de la parte "aprobada" real: crear la ficha en BD Usina
 * y pasar el `usina_victima_id` resultante en el body. Esta route NO crea
 * fichas — sólo cierra el loop de la propuesta.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthorizedSession()
  if (!auth.ok) return auth.response

  const { id: candidatoId } = await params

  let body: Partial<DecidirCandidatoInput>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const { decision, usina_victima_id, motivo_rechazo } = body

  if (!decision || !DECISIONES_VALIDAS.includes(decision as (typeof DECISIONES_VALIDAS)[number])) {
    return NextResponse.json(
      { error: `decision debe ser una de: ${DECISIONES_VALIDAS.join(", ")}` },
      { status: 400 },
    )
  }

  if ((decision === "aprobada" || decision === "duplicada") && !usina_victima_id) {
    return NextResponse.json(
      { error: `decision "${decision}" requiere usina_victima_id` },
      { status: 400 },
    )
  }

  const decididoPor = auth.session.user.email!
  const input: DecidirCandidatoInput = {
    decision: decision as DecidirCandidatoInput["decision"],
    usina_victima_id: usina_victima_id ?? null,
    motivo_rechazo: motivo_rechazo ?? null,
  }

  const resultado = await aplicarDecisionEnMdd(candidatoId, input, decididoPor)

  await registrarDecision(auth.session.supabase, {
    candidatoId,
    decision: input.decision,
    usinaVictimaId: input.usina_victima_id ?? null,
    motivoRechazo: input.motivo_rechazo ?? null,
    decididoPor,
    callbackOk: resultado.callbackOk,
  })

  if (!resultado.callbackOk) {
    const payload = {
      estado: input.decision,
      usina_victima_id: input.usina_victima_id ?? null,
      motivo_rechazo: input.motivo_rechazo ?? null,
      decidido_at: new Date().toISOString(),
      decidido_por: decididoPor,
    }
    await encolarCallbackPendiente(
      auth.session.supabase,
      candidatoId,
      payload,
      resultado.callbackError ?? "error desconocido",
    )
  }

  return NextResponse.json({
    ok: true,
    callbackOk: resultado.callbackOk,
    // Si esto es false, la decisión quedó aplicada localmente igual;
    // el cron sincroniza a MdD en breve. La UI puede mostrar un aviso.
  })
}
