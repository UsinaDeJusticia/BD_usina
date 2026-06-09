"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { fetchDashboardStats } from "@/lib/data/dashboard"

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
    color: "hsl(var(--chart-1))",
  },
  "Imputado identificado": {
    label: "Imputado identificado",
    color: "hsl(var(--chart-2))",
  },
  Procesado: {
    label: "Procesado",
    color: "hsl(var(--chart-3))",
  },
  "Juicio oral": {
    label: "Juicio oral",
    color: "hsl(var(--chart-4))",
  },
  Condenado: {
    label: "Condenado",
    color: "hsl(var(--chart-5))",
  },
  Prescripción: {
    label: "Prescripción",
    color: "hsl(var(--chart-6))",
  },
  Otros: {
    label: "Otros",
    color: "hsl(var(--muted))",
  },
}

const statusColors: { [key: string]: string } = {
  "En investigación": "hsl(var(--chart-1))",
  "Imputado identificado": "hsl(var(--chart-2))",
  Procesado: "hsl(var(--chart-3))",
  "Juicio oral": "hsl(var(--chart-4))",
  Condenado: "hsl(var(--chart-5))",
  Prescripción: "hsl(var(--chart-6))",
  Otros: "hsl(var(--muted))",
}

export function StatusDistributionChart() {
  const [data, setData] = useState<StatusData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStatusData = async () => {
      try {
        const stats = await fetchDashboardStats(createClient())
        setData(
          stats.casesByStatus.map((s) => ({
            status: s.status,
            cases: s.cases,
            fill: statusColors[s.status] || statusColors["Otros"],
          })),
        )
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
      <Card className="border-slate-200">
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
      <Card className="border-slate-200">
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
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="font-heading">Distribución por Estado Procesal</CardTitle>
        <CardDescription>Casos según su estado en el proceso judicial</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie data={data} dataKey="cases" nameKey="status" cx="50%" cy="50%" outerRadius={100} innerRadius={40}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
        <div className="grid grid-cols-2 gap-2 mt-4">
          {data.map((item) => (
            <div key={item.status} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
              <span className="text-slate-600 truncate">{item.status}</span>
              <span className="font-medium text-slate-900 ml-auto">{item.cases}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
