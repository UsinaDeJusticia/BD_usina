import { NextResponse, type NextRequest } from "next/server"
import { requireAuthorizedSession } from "@/lib/auth/require-authorized-session"
import { fetchCandidatoById } from "@/lib/mdd/candidatos"

/** Detalle de una propuesta puntual, para el pre-fill de `/casos/nuevo`. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthorizedSession()
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const candidato = await fetchCandidatoById(id)
    if (!candidato) {
      return NextResponse.json({ error: "Candidato no encontrado o ya decidido" }, { status: 404 })
    }
    return NextResponse.json({ data: candidato })
  } catch (err) {
    console.error("Error leyendo candidato de MdD:", err)
    return NextResponse.json(
      { error: "No se pudo leer el candidato de Mapa del Delito" },
      { status: 502 },
    )
  }
}
