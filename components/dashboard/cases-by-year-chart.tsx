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

// Tope de años que se rellenan. Un año mal cargado (p. ej. 1026, el campo de
// fecha no tiene límites) no debe generar miles de barras.
const MAX_GAP_FILL_YEARS = 50

// La RPC sólo devuelve los años con víctimas. Se completan los años vacíos con 0
// para que el eje temporal sea continuo y cada barra quede en su año real.
function fillYearGaps(rows: YearlyData[]): YearlyData[] {
  if (rows.length === 0) return rows
  const byYear = new Map(rows.map((row) => [Number(row.year), row.victimas]))
  const years = [...byYear.keys()]
  const first = Math.min(...years)
  const last = Math.max(...years)
  if (last - first + 1 > MAX_GAP_FILL_YEARS) return rows
  const filled: YearlyData[] = []
  for (let year = first; year <= last; year++) {
    filled.push({ year: String(year), victimas: byYear.get(year) ?? 0 })
  }
  return filled
}

export function CasesByYearChart() {
  const { data: stats, isLoading, isFetching, error, refetch } = useDashboardStats()
  const data = useMemo(() => fillYearGaps(stats?.victimasByYear ?? []), [stats])
  const sinFecha = stats?.victimasSinFecha ?? 0

  const definition = useMemo(
    () =>
      defineChart({
        marks: [barY(data, { x: "year", y: "victimas", radius: [4, 4, 0, 0] })],
        scales: {
          x: { scale: () => scaleBand().padding(0.2) },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: {
              label: "Víctimas",
              ticks: { format: (value) => value.toLocaleString("es-AR") },
            },
          },
        },
        tooltip,
      }),
    [data],
  )

  // Un refetch fallido no oculta datos que ya están en caché: sólo hay error si
  // todavía no hay datos.
  const status: ChartCardStatus = isLoading
    ? "loading"
    : error && !stats
      ? "error"
      : data.length === 0
        ? "empty"
        : "ready"

  const summary = data.map((row) => `${row.year}: ${row.victimas}`).join(", ")

  return (
    <ChartCard
      title="Víctimas por año"
      description="Año del primer hecho de cada víctima"
      status={status}
      emptyMessage="No hay víctimas con fecha de hecho registrada aún"
      onRetry={() => refetch()}
      retrying={isFetching}
    >
      <div className="dashboard-chart">
        <Chart
          definition={definition}
          height={300}
          ariaLabel="Víctimas por año del primer hecho"
          ariaDescription={`Cantidad de víctimas por año del primer hecho. ${summary}`}
        />
      </div>
      {sinFecha > 0 && (
        <p className="text-xs text-slate-500 mt-3">
          {sinFecha.toLocaleString("es-AR")} {sinFecha === 1 ? "víctima sin fecha de hecho no se grafica" : "víctimas sin fecha de hecho no se grafican"}.
        </p>
      )}
    </ChartCard>
  )
}
