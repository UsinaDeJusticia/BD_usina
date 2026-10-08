"use client"

import { useMemo } from "react"
import { defineChart } from "@tanstack/charts"
import { pie, polar, radialArc } from "@tanstack/charts/polar"
import { Chart } from "@tanstack/charts/react"
import { tooltip } from "@tanstack/charts/tooltip"
import { ChartCard, type ChartCardStatus } from "@/components/dashboard/chart-card"
import {
  ESTADO_PROCESAL,
  SIN_ESTADO,
  canonicalEstado,
  estadoLabel,
} from "@/lib/data/estado-procesal"
import { useDashboardStats } from "@/lib/queries/dashboard"

interface StatusSlice {
  status: string
  label: string
  cases: number
}

// Un token de tema por estado, en el orden de ESTADO_PROCESAL. Los tokens
// --ts-chart-N se definen en .dashboard-chart (app/globals.css).
const STATUS_COLORS = new Map<string, string>(
  ESTADO_PROCESAL.map((estado, index) => [estado.code, `var(--ts-chart-${index + 1})`]),
)
const UNKNOWN_STATUS_COLOR = "var(--muted-foreground)"

// Recibe una etiqueta o un código y devuelve su color. Los desconocidos y el
// "Sin estado" usan el color neutro.
function colorFor(label: string): string {
  return STATUS_COLORS.get(canonicalEstado(label)) ?? UNKNOWN_STATUS_COLOR
}

export function StatusDistributionChart() {
  const { data: stats, isLoading, isFetching, error, refetch } = useDashboardStats()

  // Varias filas pueden caer en el mismo estado canónico (p. ej. "condenado" y
  // "Condenado"), así que se suman antes de graficar.
  const slices = useMemo<StatusSlice[]>(() => {
    const totals = new Map<string, number>()
    for (const row of stats?.casesByStatus ?? []) {
      const key = canonicalEstado(row.status)
      totals.set(key, (totals.get(key) ?? 0) + row.cases)
    }
    return [...totals.entries()]
      .map(([status, cases]) => ({ status, label: estadoLabel(status), cases }))
      .filter((slice) => slice.cases > 0)
      .sort((a, b) => b.cases - a.cases)
  }, [stats])

  // Dominio fijo: el color de cada estado no cambia aunque cambie el orden de
  // los datos. Los estados fuera de la lista se agregan al final.
  const colorDomain = useMemo(() => {
    const known = [...ESTADO_PROCESAL.map((estado) => estado.label), estadoLabel(SIN_ESTADO)]
    const unknown = slices.map((slice) => slice.label).filter((label) => !known.includes(label))
    return [...known, ...unknown]
  }, [slices])
  const colorRange = useMemo(() => colorDomain.map(colorFor), [colorDomain])

  const total = slices.reduce((sum, slice) => sum + slice.cases, 0)

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          polar({
            inset: 8,
            radiusRatio: 0.9,
            marks: [
              radialArc(pie(slices, { value: "cases" }), {
                innerRadius: ({ radius }) => radius * 0.58,
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

  const summary = slices.map((slice) => `${slice.label}: ${slice.cases}`).join(", ")

  return (
    <ChartCard
      title="Distribución por Estado Procesal"
      description="Casos según su estado en el proceso judicial"
      status={status}
      emptyMessage="No hay casos con estado procesal registrados aún"
      onRetry={() => refetch()}
      retrying={isFetching}
    >
      <div className="dashboard-chart">
        <Chart
          definition={definition}
          height={300}
          ariaLabel="Distribución de casos por estado procesal"
          ariaDescription={`Casos por estado procesal. ${summary}`}
        />
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4" aria-label="Leyenda">
          {slices.map((slice) => (
            <li key={slice.status} className="flex items-center gap-2 text-sm min-w-0">
              <span
                aria-hidden="true"
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: colorFor(slice.label) }}
              />
              <span className="text-slate-600 truncate min-w-0">{slice.label}</span>
              <span className="font-medium text-slate-900 ml-auto tabular-nums whitespace-nowrap">
                {slice.cases}
                <span className="text-slate-500 font-normal">
                  {" "}({((slice.cases / total) * 100).toFixed(1)}%)
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  )
}
