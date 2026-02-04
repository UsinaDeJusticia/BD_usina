"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, FileText, Calendar, Scale, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface StatsData {
  totalCases: number
  casesLastYear: number
  casesWithoutConviction: number
  casesInInvestigation: number
}

export function DashboardStats() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data: victimas, error: victimasError } = await supabase.from("victimas").select(`
          id,
          created_at,
          hechos (
            id,
            fecha_hecho
          )
        `)

      if (victimasError) throw victimasError

      const { data: imputados, error: imputadosError } = await supabase.from("imputados").select(`
          id,
          estado_procesal,
          hechos!inner (
            victima_id
          )
        `)

      if (imputadosError) throw imputadosError

      const totalCases = victimas?.length || 0

      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      const casesLastYear = victimas?.filter((victim) => new Date(victim.created_at) >= oneYearAgo).length || 0

      const casesWithoutConviction =
        imputados?.filter((imputado) => imputado.estado_procesal !== "Condenado").length || 0

      const casesInInvestigation =
        imputados?.filter((imputado) => imputado.estado_procesal === "En investigación").length || 0

      setStats({
        totalCases,
        casesLastYear,
        casesWithoutConviction,
        casesInInvestigation,
      })
    } catch (err) {
      console.error("Error fetching stats:", err)
      setError("Error al cargar estadísticas")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-slate-200 shadow-sm">
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
        <Card className="border-slate-200 shadow-sm col-span-full">
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <p className="text-slate-600 mb-2">{error || "No se pudieron cargar las estadísticas"}</p>
              <button
                onClick={fetchStats}
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
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      title: "Casos Último Año",
      value: stats.casesLastYear.toString(),
      icon: Calendar,
      description: "Nuevos casos en los últimos 12 meses",
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-600",
    },
    {
      title: "Casos sin Condena",
      value: stats.casesWithoutConviction.toString(),
      icon: Scale,
      description: "Casos pendientes de resolución judicial",
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      title: "En Investigación",
      value: stats.casesInInvestigation.toString(),
      icon: AlertTriangle,
      description: "Casos actualmente bajo investigación",
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statsConfig.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title} className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                <Icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
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
