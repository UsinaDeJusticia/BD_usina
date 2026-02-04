"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"

interface StatusData {
  status: string
  cases: number
  fill: string
}

const chartConfig = {
  cases: {
    label: "Casos",
  },
  "En investigación": {
    label: "En investigación",
    color: "#f59e0b",
  },
  "Imputado identificado": {
    label: "Imputado identificado",
    color: "#3b82f6",
  },
  Procesado: {
    label: "Procesado",
    color: "#8b5cf6",
  },
  "Juicio oral": {
    label: "Juicio oral",
    color: "#ec4899",
  },
  Condenado: {
    label: "Condenado",
    color: "#10b981",
  },
  Prescripción: {
    label: "Prescripción",
    color: "#64748b",
  },
  Otros: {
    label: "Otros",
    color: "#94a3b8",
  },
}

const statusColors: { [key: string]: string } = {
  "En investigación": "#f59e0b",
  "Imputado identificado": "#3b82f6",
  Procesado: "#8b5cf6",
  "Juicio oral": "#ec4899",
  Condenado: "#10b981",
  Prescripción: "#64748b",
  Otros: "#94a3b8",
}

interface ChartTooltipProps {
  active?: boolean
  payload?: any[]
}

const CustomTooltip = ({ active, payload }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-3">
        <p className="text-sm font-medium text-slate-900 mb-1">{data.status}</p>
        <p className="text-sm text-slate-600">
          Casos: <span className="font-semibold text-slate-900">{data.cases}</span>
        </p>
      </div>
    )
  }
  return null
}

export function StatusDistributionChart() {
  const [data, setData] = useState<StatusData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStatusData = async () => {
      try {
        const supabase = createClient()

        const { data: imputados, error } = await supabase.from("imputados").select("estado_procesal")

        if (error) {
          console.error("Error fetching status data:", error)
          return
        }

        const statusCounts: { [key: string]: number } = {}

        imputados?.forEach((imputado) => {
          const status = imputado.estado_procesal || "Otros"
          statusCounts[status] = (statusCounts[status] || 0) + 1
        })

        const chartData = Object.entries(statusCounts).map(([status, cases]) => ({
          status,
          cases,
          fill: statusColors[status] || statusColors["Otros"],
        }))

        setData(chartData)
      } catch (error) {
        console.error("Error fetching status data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStatusData()
  }, [])

  if (loading) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading">Distribución por Estado Procesal</CardTitle>
          <CardDescription>Casos según su estado en el proceso judicial</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-slate-500">Cargando datos...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading">Distribución por Estado Procesal</CardTitle>
          <CardDescription>Casos según su estado en el proceso judicial</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-slate-500">No hay casos con estado procesal registrados aún</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="font-heading">Distribución por Estado Procesal</CardTitle>
        <CardDescription>Casos según su estado en el proceso judicial</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Pie data={data as any} dataKey="cases" nameKey="status" cx="50%" cy="50%" outerRadius={100} innerRadius={60} labelLine={false}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {data.map((item) => (
            <div key={item.status} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-slate-50">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.fill }} />
              <span className="text-slate-600 truncate font-medium">{item.status}</span>
              <span className="ml-auto font-bold text-slate-900">{item.cases}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
