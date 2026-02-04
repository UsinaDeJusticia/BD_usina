"use client"

import { useState, useEffect, useRef, forwardRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface TooltipProps {
  x: number
  y: number
  province: string
  cases: number
  visible: boolean
}

const CustomTooltip = ({ x, y, province, cases, visible }: TooltipProps) => {
  if (!visible) return null

  return (
    <div
      className="fixed pointer-events-none z-50 bg-white rounded-lg shadow-xl border border-slate-200 p-3 min-w-[150px]"
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      <p className="text-sm font-semibold text-slate-900 mb-1">{province}</p>
      <p className="text-sm text-slate-600">
        Casos: <span className="font-bold text-blue-600">{cases}</span>
      </p>
    </div>
  )
}

const ARGENTINA_GEOJSON_URL = "https://gist.githubusercontent.com/aguspina/570fe8c52bb9628f38618ad9b037f4e7/raw/argentina.geojson"

const normalizeProvinceName = (name: string): string => {
  const nameMap: Record<string, string> = {
    "Ciudad de Buenos Aires": "CABA",
    "Buenos Aires": "Buenos Aires",
    "Córdoba": "Córdoba",
    "Santa Fe": "Santa Fe",
    "Mendoza": "Mendoza",
    "Tucumán": "Tucumán",
    "Entre Ríos": "Entre Ríos",
    "Salta": "Salta",
    "Misiones": "Misiones",
    "Chaco": "Chaco",
    "Chubut": "Chubut",
    "San Juan": "San Juan",
    "San Luis": "San Luis",
    "La Rioja": "La Rioja",
    "La Pampa": "La Pampa",
    "Santiago del Estero": "Santiago del Estero",
    "Catamarca": "Catamarca",
    "Jujuy": "Jujuy",
    "Río Negro": "Río Negro",
    "Neuquén": "Neuquén",
    "Formosa": "Formosa",
    "Corrientes": "Corrientes",
    "Santa Cruz": "Santa Cruz",
    "Tierra del Fuego": "Tierra del Fuego, Antártida e Islas del Atlántico Sur",
  }
  return nameMap[name] || name
}

export function ArgentinaMap() {
  const [provinceData, setProvinceData] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipProps>({
    x: 0,
    y: 0,
    province: "",
    cases: 0,
    visible: false,
  })
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreGL.Map | null>
  const supabase = createClient()

  useEffect(() => {
    const handleTooltipUpdate = (e: Event) => {
      const tooltipEvent = e as CustomEvent<TooltipProps>
      setTooltip(tooltipEvent.detail)
    }

    window.addEventListener("tooltipUpdate", handleTooltipUpdate)
    return () => window.removeEventListener("tooltipUpdate", handleTooltipUpdate)
  }, [])

  useEffect(() => {
    fetchCasesByProvince()
  }, [])

  const fetchCasesByProvince = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase.from("hechos").select("provincia")

      if (fetchError) throw fetchError

      const provinceCounts: Record<string, number> = {}
      data.forEach((incident: any) => {
        if (incident.provincia) {
          provinceCounts[incident.provincia] = (provinceCounts[incident.provincia] || 0) + 1
        }
      })

      setProvinceData(provinceCounts)
    } catch (err) {
      console.error("Error fetching case locations:", err)
      setError("Error al cargar la distribución de casos")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isLoading || !mapContainerRef.current) return

    const map = new MapLibreGL.Map({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [-63.6167, -38.4161] as [number, number],
      zoom: 3.5,
      minZoom: 3,
      maxZoom: 10,
      attributionControl: { compact: true },
    })

    mapRef.current = map

    const fetchAndAddGeoJSON = async () => {
      try {
        const response = await fetch(ARGENTINA_GEOJSON_URL)
        const geojsonData = await response.json()
        
        map.addSource("provincias", {
          type: "geojson",
          data: geojsonData,
        })

        map.addLayer({
          id: "provincias-fill",
          type: "fill",
          source: "provincias",
          paint: {
            "fill-color": "#f1f5f9",
            "fill-opacity": 0.8,
            "fill-outline-color": "#94a3b8",
          }
        })
      } catch (error) {
        console.error("Error loading GeoJSON:", error)
      }
    }

    map.on("load", () => {
      fetchAndAddGeoJSON()
    })

    map.on("mousemove", "provincias-fill", (e: any) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["provincias-fill"],
        })

      if (features && features.length > 0) {
        const feature = features[0]
        const provinceName = normalizeProvinceName(feature.properties?.NAME_1 || "Desconocido")
        const cases = provinceData[provinceName] || 0

        let fillColor = "#f1f5f9"

        if (cases > 0) {
          const values = Object.values(provinceData)
            const maxValue = Math.max(...values, 1)
            if (cases > maxValue * 0.75) fillColor = "#1e40af"
          else if (cases > maxValue * 0.5) fillColor = "#2563eb"
          else fillColor = "#3b82f6"
          else fillColor = "#93c5fd"
          }

        setTooltip({
              x: e.point.x + window.scrollX,
              y: e.point.y + window.scrollY,
              province: provinceName,
              cases,
              visible: true,
              })
        }
      }
    })

    map.on("mouseleave", "provincias-fill", () => {
      setTooltip({ ...tooltip, visible: false })
    })
    }

    const handleMove = () => {
      window.removeEventListener("mousemove", handleMove)
    }

    const mapRef.current?.remove()
  }

    return () => {
      mapRef.current?.remove()
    }
  }, [isLoading, mapContainerRef.current, provinceData])
}

  if (isLoading) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading">Mapa de Casos por Provincia</CardTitle>
          <CardDescription>Distribución geográfica de los casos registrados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-2 text-slate-600">Cargando mapa...</span>
            </div>
          </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading">Mapa de Casos por Provincia</CardTitle>
          <CardDescription>Error al cargar los datos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-slate-600 mb-4">{error}</p>
              <button
                onClick={fetchCasesByProvince}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Reintentar
              </button>
            </div>
          </CardContent>
      </Card>
    )
  }

  const totalCases = Object.values(provinceData).reduce((sum, val) => sum + val, 0)
  const sortedProvinces = Object.entries(provinceData)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)

  const values = Object.values(provinceData)
  const maxValue = Math.max(...values, 1)

  return (
      <>
        <CustomTooltip
          x={tooltip.x}
          y={tooltip.y}
          province={tooltip.province}
          cases={tooltip.cases}
          visible={tooltip.visible}
          />
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading">Mapa de Casos por Provincia</CardTitle>
            <CardDescription>Distribución geográfica de los casos registrados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                  <div className="bg-gradient-to-br from-blue-50 to-slate-100 rounded-lg p-6">
                        <div className="h-[600px] w-full rounded-lg overflow-hidden" ref={mapContainerRef}></div>
                  </div>
            </div>

            <div className="space-y-6">
                  <h4 className="font-medium text-slate-900 mb-3 font-heading">Leyenda</h4>
                  <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                              <div className="w-4 h-4 rounded bg-[#1e40af]"></div>
                                <span className="text-slate-600">Alta densidad ({Math.round(maxValue * 0.75)}+ casos)</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-4 h-4 rounded bg-[#2563eb]"></div>
                                <span className="text-slate-600">
                                  Media-alta ({Math.round(maxValue * 0.5)}-{Math.round(maxValue * 0.75)} casos)
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-4 h-4 rounded bg-[#3b82f6]"></div>
                                <span className="text-slate-600">
                                  Media ({Math.round(maxValue * 0.25)}-{Math.round(maxValue * 0.5)} casos)
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-4 h-4 rounded bg-[#93c5fd]"></div>
                                <span className="text-slate-600">
                                  Baja (1-{Math.round(maxValue * 0.25)} casos)
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-4 h-4 rounded bg-[#f1f5f9] border border-slate-300"></div>
                                <span className="text-slate-600">Sin casos</span>
                                </div>
                              </div>
                              </div>
                          </div>

                          <div className="space-y-6">
                              <h4 className="font-medium text-slate-900 mb-3 font-heading">Top Provincias</h4>
                              <div className="space-y-2">
                                  {sortedProvinces.slice(0, 5).map(([province, count]) => (
                                    <div key={province} className="flex items-center justify-between text-sm">
                                      <span className="text-slate-600">{province}</span>
                                      <span className="font-bold text-blue-600">{count}</span>
                                    </div>
                                  </div>
                                  {sortedProvinces.length === 0 && (
                                    <p className="text-sm text-slate-500">No hay casos registrados</p>
                                    )}
                                  )}
                              </div>
                          </div>

                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                <h5 className="font-medium text-slate-900 mb-2 text-sm">Resumen Geográfico</h5>
                                <div className="space-y-1 text-xs text-slate-600">
                                  <div className="space-y-1 text-xs text-slate-600">
                                    <div className="flex justify-between">
                                      <span>Total provincias:</span>
                                      <span className="font-medium">24</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Con casos registrados:</span>
                                        <span className="font-medium">{sortedProvinces.length}</span>
                                      </div>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Total casos:</span>
                                        <span className="font-medium">{totalCases}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                          </div>
                        </div>
                  </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
  }
}