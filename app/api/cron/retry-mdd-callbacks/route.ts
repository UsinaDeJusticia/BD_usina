import { NextResponse, type NextRequest } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import { getMddClient } from "@/lib/mdd/client"

const MAX_INTENTOS = 10

/**
 * Reintenta los callbacks de decisión que fallaron contra Mapa del Delito
 * (ver app/api/candidatos/[id]/decidir/route.ts). Invocado por Vercel Cron
 * cada 5 minutos (ver vercel.json).
 *
 * Corre sin sesión de usuario -> usa el cliente de service role (bypassa
 * RLS) sólo para esta tabla puntual. Verificado con CRON_SECRET, patrón
 * estándar de Vercel Cron: si la env var existe, Vercel manda
 * `Authorization: Bearer <CRON_SECRET>` automáticamente en cada invocación.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
  }

  const supabase = getServiceRoleClient()

  const { data: pendientes, error } = await supabase
    .from("pending_callbacks_mdd")
    .select("*")
    .eq("resuelto", false)
    .lt("intentos", MAX_INTENTOS)
    .order("created_at", { ascending: true })
    .limit(50)

  if (error) {
    console.error("Error leyendo pending_callbacks_mdd:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let resueltos = 0
  let fallidos = 0

  for (const callback of pendientes ?? []) {
    try {
      const { error: mddError } = await getMddClient()
        .from("propuestas_para_usina")
        .update(callback.payload)
        .eq("id", callback.candidato_id)

      if (mddError) throw new Error(mddError.message)

      await supabase
        .from("pending_callbacks_mdd")
        .update({ resuelto: true, updated_at: new Date().toISOString() })
        .eq("id", callback.id)
      resueltos++
    } catch (err) {
      fallidos++
      await supabase
        .from("pending_callbacks_mdd")
        .update({
          intentos: callback.intentos + 1,
          ultimo_error: err instanceof Error ? err.message : "Error desconocido",
          updated_at: new Date().toISOString(),
        })
        .eq("id", callback.id)
    }
  }

  return NextResponse.json({
    procesados: pendientes?.length ?? 0,
    resueltos,
    fallidos,
  })
}
