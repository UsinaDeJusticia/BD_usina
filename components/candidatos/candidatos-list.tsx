"use client"

import { Loader2, Inbox } from "lucide-react"
import { useCandidatosPendientes } from "@/lib/queries/candidatos"
import { CandidatoCard } from "./candidato-card"
import { Button } from "@/components/ui/button"

export function CandidatosList() {
  const { data: candidatos = [], isLoading, error, refetch } = useCandidatosPendientes()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Cargando candidatos...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-600 mb-4">
          No se pudo conectar con Mapa del Delito. {error instanceof Error ? error.message : ""}
        </p>
        <Button onClick={() => refetch()} variant="outline">
          Reintentar
        </Button>
      </div>
    )
  }

  if (candidatos.length === 0) {
    return (
      <div className="text-center py-16">
        <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">No hay candidatos pendientes de revisión.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {candidatos.map((c) => (
        <CandidatoCard key={c.id} candidato={c} />
      ))}
    </div>
  )
}
