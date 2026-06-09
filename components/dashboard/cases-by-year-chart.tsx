"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { fetchDashboardStats, type YearlyData } from "@/lib/data/dashboard"

const chartConfig = {
  cases: {
    label: "Casos",
    color: "hsl(var(--chart-1))",
  },
}

export function CasesByYearChart() {
  const [data, setData] = useState<YearlyData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchYearlyData = async () => {
      try {
        const stats = await fetchDashboardStats(createClient())
        setData(stats.casesByYear)
      } catch (error) {
        console.error("Error fetching yearly data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchYearlyData()
  }, [])

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="font-heading">Casos por Año</CardTitle>
          <CardDescription>Evolución del número de casos registrados</CardDescription>
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
          <CardTitle className="font-heading">Casos por Año</CardTitle>
          <CardDescription>Evolución del número de casos registrados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-slate-500">No hay casos registrados aún</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="font-heading">Casos por Año</CardTitle>
        <CardDescription>Evolución del número de casos registrados</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <XAxis
                dataKey="year"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `${value}`} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="cases" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
