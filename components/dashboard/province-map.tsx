"use client"

import { useMemo } from "react"
import type { Feature, Geometry } from "geojson"
import { defineChart } from "@tanstack/charts"
import { geoShape } from "@tanstack/charts/geo"
import { Chart } from "@tanstack/charts/react"
import { scaleSequential, scaleSequentialSqrt } from "d3-scale"
import { geoTransverseMercator } from "d3-geo"
import { interpolateBlues } from "d3-scale-chromatic"
import { ChartCard, type ChartCardStatus } from "@/components/dashboard/chart-card"
import { victimasPorProvincia } from "@/lib/data/provincias"
import { useDashboardStats } from "@/lib/queries/dashboard"
import { useProvinciasGeo, type ProvinciaProperties } from "@/lib/queries/geo"

// Provincias sin víctimas: gris neutro, distinguible del primer tramo de la rampa.
const SIN_VICTIMAS = "#e2e8f0"

// Rampa azul. Se aclara el inicio para que las provincias con pocos casos sigan
// viéndose. Se usa tanto para pintar como para la leyenda.
const blue = (t: number) => interpolateBlues(0.25 + 0.75 * t)

type ProvinciaFeature = Feature<Geometry, ProvinciaProperties & { victimas: number }>

// Proyección de la fuente (la misma que documenta @trase/trase-atlas).
const projection = {
  type: () => geoTransverseMercator().rotate([69, 0]),
  fit: "data" as const,
  inset: 8,
}

export function ProvinceMap() {
  const { data: stats, isLoading: statsLoading, isFetching, error: statsError, refetch } = useDashboardStats()
  const { data: geo, isLoading: geoLoading, error: geoError, refetch: refetchGeo } = useProvinciasGeo()

  const { porProvincia, sinUbicar } = useMemo(
    () => victimasPorProvincia(stats?.victimasByProvince ?? []),
    [stats],
  )
  const max = useMemo(() => Math.max(0, ...porProvincia.values()), [porProvincia])
  const total = useMemo(() => [...porProvincia.values()].reduce((sum, n) => sum + n, 0) + sinUbicar, [porProvincia, sinUbicar])

  // Escala sqrt: el color de cada provincia coincide con blue(sqrt(v / max)).
  // La leyenda usa la misma relación, así que sus tramos son exactos.
  const ramp = useMemo(() => scaleSequentialSqrt(blue).domain([0, max || 1]), [max])

  const definition = useMemo(() => {
    if (!geo) return null
    const features: ProvinciaFeature[] = geo.features.map((feature) => ({
      ...feature,
      properties: { ...feature.properties, victimas: porProvincia.get(feature.properties.provincia) ?? 0 },
    }))
    return defineChart({
      marks: [
        geoShape(features, {
          key: (feature) => feature.properties.indec,
          projection,
          color: (feature) => feature.properties.victimas,
          fill: (feature) => (feature.properties.victimas > 0 ? ramp(feature.properties.victimas) : SIN_VICTIMAS),
          stroke: "#ffffff",
          strokeWidth: 0.8,
        }),
      ],
      scales: { x: null, y: null },
      color: { scale: () => scaleSequential(blue) },
      // El foco por centroide asignaba el polígono vecino al puntero (geoShape no
      // tiene hit test por área). Sin foco, la provincia y su cifra se leen en la
      // descripción accesible y en el ranking de al lado.
      maxFocusDistance: 0,
      margin: 12,
    })
  }, [geo, porProvincia, ramp])

  const status: ChartCardStatus =
    (statsLoading || geoLoading)
      ? "loading"
      : (statsError && !stats) || (geoError && !geo)
        ? "error"
        : total === 0
          ? "empty"
          : "ready"

  const summary = [...porProvincia.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([provincia, n]) => `${provincia}: ${n}`)
    .join(", ")

  // Gradiente de la leyenda: cada parada es blue(p) y el valor en p es max * p².
  const gradientStops = Array.from({ length: 11 }, (_, i) => `${blue(i / 10)} ${i * 10}%`).join(", ")
  // Marcas de la leyenda. Con máximos chicos no hay un punto medio distinto del
  // mínimo o del máximo, así que se omite para no mostrar valores repetidos.
  const legendLabels =
    max <= 0
      ? []
      : max === 1
        ? ["1"]
        : max < 4
          ? ["1", max.toLocaleString("es-AR")]
          : ["1", Math.round(max * 0.25).toLocaleString("es-AR"), max.toLocaleString("es-AR")]

  return (
    <ChartCard
      title="Víctimas por provincia"
      description="Provincia del primer hecho de cada víctima"
      status={status}
      emptyMessage="No hay víctimas con provincia registrada aún"
      onRetry={() => {
        refetch()
        refetchGeo()
      }}
      retrying={isFetching}
    >
      {definition && (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_200px] md:items-center">
          <Chart
            definition={definition}
            height={460}
            ariaLabel="Mapa de víctimas por provincia"
            ariaDescription={`Víctimas por provincia del primer hecho. ${summary}`}
          />
          <div className="space-y-5 text-xs text-slate-600">
            {max > 0 && (
              <div>
                <p className="mb-2 font-medium text-slate-700">Víctimas</p>
                <div
                  className="h-3 w-full rounded-sm"
                  style={{ background: `linear-gradient(to right, ${gradientStops})` }}
                  aria-hidden="true"
                />
                <div className="mt-1 flex justify-between tabular-nums">
                  {legendLabels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: SIN_VICTIMAS }} aria-hidden="true" />
              Sin víctimas
            </div>
            {sinUbicar > 0 && (
              <p className="text-slate-500">
                {sinUbicar.toLocaleString("es-AR")} víctimas sin provincia reconocida, no se dibujan.
              </p>
            )}
            <p className="text-slate-500">
              Límites: IGN (Capas SIG 2019). Tierra del Fuego muestra sólo la Isla Grande.
            </p>
          </div>
        </div>
      )}
    </ChartCard>
  )
}
