"use client"

import { useMemo } from "react"
import { defineChart } from "@tanstack/charts"
import { pie, polar, radialArc } from "@tanstack/charts/polar"
import { Chart } from "@tanstack/charts/react"
import { tooltip } from "@tanstack/charts/tooltip"
import { ChartCard, type ChartCardStatus } from "@/components/dashboard/chart-card"
import { SITUACION_VICTIMA, situacionLabel } from "@/lib/data/situacion-victimas"
import { useDashboardStats } from "@/lib/queries/dashboard"

interface SituacionSlice {
  status: string
  label: string
  victimas: number
}

// Un token de tema por situación, en el orden de SITUACION_VICTIMA. Los tokens
// --ts-chart-N se definen en .dashboard-chart (app/globals.css).
const COLOR_BY_STATUS = new Map<string, string>(
  SITUACION_VICTIMA.map((situacion, index) => [situacion.code, `var(--ts-chart-${index + 1})`]),
)

export function StatusDistributionChart() {
  const { data: stats, isLoading, isFetching, error, refetch } = useDashboardStats()

  const slices = useMemo<SituacionSlice[]>(
    () =>
      (stats?.victimasByStatus ?? [])
        .filter((row) => row.victimas > 0)
        .map((row) => ({ status: row.status, label: situacionLabel(row.status), victimas: row.victimas }))
        .sort((a, b) => b.victimas - a.victimas),
    [stats],
  )

  // Dominio fijo para que cada situación conserve su color aunque cambien los datos.
  const colorDomain = useMemo(() => SITUACION_VICTIMA.map((situacion) => situacion.label), [])
  const colorRange = useMemo(
    () => SITUACION_VICTIMA.map((situacion) => COLOR_BY_STATUS.get(situacion.code) ?? "var(--muted-foreground)"),
    [],
  )
  const colorFor = (status: string) => COLOR_BY_STATUS.get(status) ?? "var(--muted-foreground)"

  const total = slices.reduce((sum, slice) => sum + slice.victimas, 0)

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          polar({
            inset: 8,
            radiusRatio: 0.9,
            marks: [
              radialArc(pie(slices, { value: "victimas" }), {
                innerRadius: ({ radius }) => radius * 0.62,
                cornerRadius: 3,
                color: "label",
                key: "status",
              }),
            ],
            scales: { angle: null, radius: null },
          }),
        ],
        scales: { x: null, y: null },
        color: { domain: colorDomain, range: colorRange },
        tooltip,
      }),
    [slices, colorDomain, colorRange],
  )

  // Un refetch fallido no oculta datos que ya están en caché (ver cases-by-year-chart).
  const status: ChartCardStatus = isLoading
    ? "loading"
    : error && !stats
      ? "error"
      : slices.length === 0
        ? "empty"
        : "ready"

  const summary = slices.map((slice) => `${slice.label}: ${slice.victimas}`).join(", ")

  return (
    <ChartCard
      title="Situación procesal de las víctimas"
      description="Estado más avanzado entre los imputados de cada víctima"
      status={status}
      emptyMessage="No hay víctimas con casos registrados aún"
      onRetry={() => refetch()}
      retrying={isFetching}
    >
      <div className="dashboard-chart">
        <div className="relative">
          <Chart
            definition={definition}
            height={300}
            ariaLabel="Situación procesal de las víctimas"
            ariaDescription={`Víctimas por situación procesal. Total ${total}. ${summary}`}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-slate-900 font-heading tabular-nums">
              {total.toLocaleString("es-AR")}
            </span>
            <span className="text-xs text-slate-500">víctimas</span>
          </div>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4" aria-label="Leyenda">
          {slices.map((slice) => (
            <li key={slice.status} className="flex items-center gap-2 text-sm min-w-0">
              <span
                aria-hidden="true"
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: colorFor(slice.status) }}
              />
              <span className="text-slate-600 truncate min-w-0">{slice.label}</span>
              <span className="font-medium text-slate-900 ml-auto tabular-nums whitespace-nowrap">
                {slice.victimas.toLocaleString("es-AR")}
                <span className="text-slate-500 font-normal">
                  {" "}({((slice.victimas / total) * 100).toFixed(1)}%)
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  )
}
