"use client"

import { useMemo } from "react"
import { barX, defineChart } from "@tanstack/charts"
import { scaleBand } from "@tanstack/charts/scales/band"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { Chart } from "@tanstack/charts/react"
import { tooltip } from "@tanstack/charts/tooltip"
import { ChartCard, type ChartCardStatus } from "@/components/dashboard/chart-card"
import { PROVINCIAS, nombreCorto, victimasPorProvincia } from "@/lib/data/provincias"
import { useDashboardStats } from "@/lib/queries/dashboard"

interface RankingRow {
  provincia: string
  victimas: number
}

// Altura por fila, para que las barras y sus etiquetas no se apelotonen.
const ROW_HEIGHT = 22
const MIN_HEIGHT = 240

export function ProvinceRankingChart() {
  const { data: stats, isLoading, isFetching, error, refetch } = useDashboardStats()

  // Las 24 jurisdicciones, de mayor a menor. Las que no tienen víctimas quedan al final.
  const rows = useMemo<RankingRow[]>(() => {
    const { porProvincia } = victimasPorProvincia(stats?.victimasByProvince ?? [])
    return PROVINCIAS.map((provincia) => ({
      provincia: nombreCorto(provincia),
      victimas: porProvincia.get(provincia) ?? 0,
    })).sort((a, b) => b.victimas - a.victimas || a.provincia.localeCompare(b.provincia))
  }, [stats])

  const definition = useMemo(
    () =>
      defineChart({
        marks: [barX(rows, { x: "victimas", y: "provincia", radius: [0, 4, 4, 0] })],
        scales: {
          y: { scale: () => scaleBand().padding(0.25) },
          x: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: { label: "Víctimas", ticks: { format: (value) => value.toLocaleString("es-AR") } },
          },
        },
        tooltip,
      }),
    [rows],
  )

  const status: ChartCardStatus = isLoading
    ? "loading"
    : error && !stats
      ? "error"
      : rows.every((row) => row.victimas === 0)
        ? "empty"
        : "ready"

  const height = Math.max(MIN_HEIGHT, rows.length * ROW_HEIGHT + 40)
  const summary = rows
    .filter((row) => row.victimas > 0)
    .map((row) => `${row.provincia}: ${row.victimas}`)
    .join(", ")

  return (
    <ChartCard
      title="Ranking por provincia"
      description="Víctimas por provincia del primer hecho"
      status={status}
      emptyMessage="No hay víctimas con provincia registrada aún"
      onRetry={() => refetch()}
      retrying={isFetching}
    >
      <div className="dashboard-chart">
        <Chart
          definition={definition}
          height={height}
          ariaLabel="Ranking de víctimas por provincia"
          ariaDescription={`Víctimas por provincia, de mayor a menor. ${summary}`}
        />
      </div>
    </ChartCard>
  )
}
