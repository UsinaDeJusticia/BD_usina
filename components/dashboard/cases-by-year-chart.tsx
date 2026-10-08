"use client"

import { useMemo } from "react"
import { barY, defineChart } from "@tanstack/charts"
import { scaleBand } from "@tanstack/charts/scales/band"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { Chart } from "@tanstack/charts/react"
import { tooltip } from "@tanstack/charts/tooltip"
import { ChartCard, type ChartCardStatus } from "@/components/dashboard/chart-card"
import type { YearlyData } from "@/lib/data/dashboard"
import { useDashboardStats } from "@/lib/queries/dashboard"

// La RPC sólo devuelve los años con casos. Se completan los años vacíos con 0
// para que el eje temporal sea continuo y cada barra quede en su año real.
function fillYearGaps(rows: YearlyData[]): YearlyData[] {
  if (rows.length === 0) return rows
  const byYear = new Map(rows.map((row) => [Number(row.year), row.cases]))
  const years = [...byYear.keys()]
  const first = Math.min(...years)
  const last = Math.max(...years)
  const filled: YearlyData[] = []
  for (let year = first; year <= last; year++) {
    filled.push({ year: String(year), cases: byYear.get(year) ?? 0 })
  }
  return filled
}

export function CasesByYearChart() {
  const { data: stats, isLoading, error, refetch } = useDashboardStats()
  const data = useMemo(() => fillYearGaps(stats?.casesByYear ?? []), [stats])

  const definition = useMemo(
    () =>
      defineChart({
        marks: [barY(data, { x: "year", y: "cases", radius: [4, 4, 0, 0] })],
        scales: {
          x: { scale: () => scaleBand().padding(0.2) },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: {
              label: "Casos",
              ticks: { format: (value) => value.toLocaleString("es-AR") },
            },
          },
        },
        tooltip,
      }),
    [data],
  )

  const status: ChartCardStatus = isLoading
    ? "loading"
    : error
      ? "error"
      : data.length === 0
        ? "empty"
        : "ready"

  const summary = data.map((row) => `${row.year}: ${row.cases}`).join(", ")

  return (
    <ChartCard
      title="Casos por Año"
      description="Evolución del número de casos registrados por año del hecho"
      status={status}
      emptyMessage="No hay casos registrados aún"
      onRetry={() => refetch()}
    >
      <div className="dashboard-chart">
        <Chart
          definition={definition}
          height={300}
          ariaLabel="Casos por año"
          ariaDescription={`Cantidad de casos por año del hecho. ${summary}`}
        />
      </div>
    </ChartCard>
  )
}
