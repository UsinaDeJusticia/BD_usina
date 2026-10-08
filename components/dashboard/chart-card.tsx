"use client"

import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export type ChartCardStatus = "loading" | "error" | "empty" | "ready"

interface ChartCardProps {
  title: string
  description: string
  status: ChartCardStatus
  emptyMessage: string
  onRetry: () => void
  children: ReactNode
}

// Muestra el gráfico sólo cuando hay datos. Loading, error y vacío tienen su
// propio mensaje, para que un fallo de la consulta no se vea como "sin casos".
export function ChartCard({ title, description, status, emptyMessage, onRetry, children }: ChartCardProps) {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="font-heading">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {status === "ready" && children}
        {status === "loading" && (
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-slate-500">Cargando datos...</p>
          </div>
        )}
        {status === "empty" && (
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-slate-500">{emptyMessage}</p>
          </div>
        )}
        {status === "error" && (
          <div className="flex flex-col items-center justify-center h-[300px] gap-3">
            <p className="text-slate-600">No se pudieron cargar los datos</p>
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Reintentar
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
