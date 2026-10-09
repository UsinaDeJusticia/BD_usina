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

// Tope de huecos a rellenar. Un año mal cargado (p. ej. 1026, el campo de fecha
// no tiene límites) deja un salto enorme: no se rellena, pero tampoco se generan
// miles de barras vacías.
const MAX_GAP_FILL_YEARS = 50

// La RPC sólo devuelve los años con víctimas. Se completan con 0 los años vacíos
// entre dos años con datos, para que cada barra quede en su año real.
function fillYearGaps(rows: YearlyData[]): YearlyData[] {
  if (rows.length === 0) return rows
  const sorted = [...rows].sort((a, b) => Number(a.year) - Number(b.year))
  const filled: YearlyData[] = []
  sorted.forEach((row, index) => {
    if (index > 0) {
      const previous = Number(sorted[index - 1].year)
      const current = Number(row.year)
      const missing = current - previous - 1
      if (missing > 0 && missing <= MAX_GAP_FILL_YEARS) {
        for (let year = previous + 1; year < current; year++) {
          filled.push({ year: String(year), victimas: 0 })
        }
      }
    }
    filled.push(row)
  })
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
