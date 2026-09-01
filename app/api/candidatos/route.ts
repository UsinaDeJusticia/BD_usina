import { NextResponse } from "next/server"
import { requireAuthorizedSession } from "@/lib/auth/require-authorized-session"
import { fetchCandidatosPendientes } from "@/lib/mdd/candidatos"

/**
 * Lista de propuestas pendientes de Mapa del Delito, para la cola de
 * revisión en `/candidatos`. Proxy server-side: el browser nunca ve
 * `MDD_SUPABASE_JWT` (ver lib/mdd/client.ts).
 */
export async function GET() {
  const auth = await requireAuthorizedSession()
  if (!auth.ok) return auth.response

  try {
    const candidatos = await fetchCandidatosPendientes()
    return NextResponse.json({ data: candidatos })
  } catch (err) {
    console.error("Error listando candidatos de MdD:", err)
    return NextResponse.json(
      { error: "No se pudo leer la cola de candidatos de Mapa del Delito" },
      { status: 502 },
    )
  }
}
