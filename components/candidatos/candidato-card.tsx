"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Calendar, MapPin, Newspaper } from "lucide-react"
import type { PropuestaCandidata } from "@/lib/mdd/types"
import { CandidatoDetailDialog } from "./candidato-detail-dialog"

interface CandidatoCardProps {
  candidato: PropuestaCandidata
}

const DUPLICADO_THRESHOLD = 0.7

export function CandidatoCard({ candidato }: CandidatoCardProps) {
  const posibleDuplicado = (candidato.duplicado_check?.match_score_max ?? 0) > DUPLICADO_THRESHOLD

  return (
    <CandidatoDetailDialog candidato={candidato}>
      <Card
        className={`cursor-pointer hover:shadow-md transition-shadow ${
          posibleDuplicado ? "border-red-300 bg-red-50/40" : "border-slate-200"
        }`}
      >
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-slate-900 line-clamp-2">{candidato.nombre_completo}</h3>
            {posibleDuplicado && (
              <Badge className="bg-red-100 text-red-800 border-red-200 shrink-0 gap-1">
                <AlertTriangle className="w-3 h-3" />
                Posible duplicado
              </Badge>
            )}
          </div>

          <div className="space-y-1.5 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="line-clamp-1">
                {[candidato.municipio, candidato.provincia].filter(Boolean).join(", ") || "Sin ubicación"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>{candidato.fecha_hecho || "Fecha sin precisar"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Newspaper className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>
                {candidato.fuentes.length} fuente{candidato.fuentes.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {candidato.tipo_crimen && (
            <Badge variant="outline" className="text-xs">
              {candidato.tipo_crimen}
            </Badge>
          )}

          {candidato.confianza_score != null && (
            <div className="text-xs text-slate-400">
              Confianza del scraper: {(candidato.confianza_score * 100).toFixed(0)}%
            </div>
          )}
        </CardContent>
      </Card>
    </CandidatoDetailDialog>
  )
}
