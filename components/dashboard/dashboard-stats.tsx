"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, FileText, Calendar, Scale, Loader2 } from "lucide-react"
import { useDashboardStats } from "@/lib/queries/dashboard"

export function DashboardStats() {
  const { data, isLoading, error, refetch } = useDashboardStats()
  const stats = data?.kpis ?? null

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-slate-200">
            <CardContent className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="border-slate-200 col-span-full">
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <p className="text-slate-600 mb-2">
                {error instanceof Error
                  ? "Error al cargar estadísticas"
                  : "No se pudieron cargar las estadísticas"}
              </p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Reintentar
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statsConfig = [
    {
      title: "Total de Casos",
      value: stats.totalCases.toString(),
      icon: FileText,
      description: "Casos registrados en el sistema",
    },
    {
      title: "Casos Último Año",
      value: stats.casesLastYear.toString(),
      icon: Calendar,
      description: "Nuevos casos en los últimos 12 meses",
    },
    {
      title: "Casos sin Condena",
      value: stats.casesWithoutConviction.toString(),
      icon: Scale,
      description: "Casos pendientes de resolución judicial",
    },
    {
      title: "En Investigación",
      value: stats.casesInInvestigation.toString(),
      icon: AlertTriangle,
      description: "Casos actualmente bajo investigación",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statsConfig.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title} className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{stat.title}</CardTitle>
              <Icon className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 font-heading">{stat.value}</div>
              <p className="text-xs text-slate-500 mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
