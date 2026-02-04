"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, User, Loader2, ChevronLeft, ChevronRight, ArrowLeft, Phone, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { CasesFilters } from "@/components/cases/cases-filters"

interface CaseData {
  id: string
  victimName: string
  incidentDate: string
  location: string
  province: string
  status: string
  familyContactName: string
  familyRelationship: string
  familyContactPhone: string
  hechoId: string
  totalVictimsInHecho: number
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "En investigación":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "Imputado identificado":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "Procesado":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "Juicio oral":
      return "bg-purple-100 text-purple-800 border-purple-200"
    case "Condenado":
      return "bg-green-100 text-green-800 border-green-200"
    case "Absuelto":
      return "bg-gray-100 text-gray-800 border-gray-200"
    case "Sobreseído":
      return "bg-slate-100 text-slate-800 border-slate-200"
    case "Archivo":
      return "bg-red-100 text-red-800 border-red-200"
    case "Prescripción":
      return "bg-purple-100 text-purple-800 border-purple-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

interface CaseCardProps {
  case: CaseData
}

function CaseCard({ case: caseData }: CaseCardProps) {
  return (
    <Link href={`/casos/${caseData.id}`}>
      <Card className="hover:shadow-lg transition-all duration-300 border-slate-200 hover:border-blue-300 cursor-pointer hover:scale-105">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg text-slate-900 font-heading mb-2 line-clamp-2">
                {caseData.victimName}
              </h3>
              <div className="flex flex-wrap gap-2">
                <Badge className={`text-xs ${getStatusColor(caseData.status)}`}>{caseData.status}</Badge>
                {caseData.totalVictimsInHecho > 1 && (
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {caseData.totalVictimsInHecho} víctimas
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="line-clamp-1">
                  {caseData.location}, {caseData.province}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span className="line-clamp-1">
                  {caseData.familyContactName} {caseData.familyRelationship ? `- ${caseData.familyRelationship}` : ""}
                </span>
              </div>

              {caseData.familyContactPhone && caseData.familyContactPhone !== "No especificado" && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-600" />
                  <span className="line-clamp-1 font-mono text-xs">{caseData.familyContactPhone}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function CasosPage() {
  const [cases, setCases] = useState<CaseData[]>([])
  const [filteredCases, setFilteredCases] = useState<CaseData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    province: "",
    location: "",
    status: "",
    assignedMember: "",
    searchTerm: "",
  })

  const casesPerPage = 12
  const supabase = createClient()

  useEffect(() => {
    fetchCases()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [cases, filters])

  const fetchCases = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data: casosData, error: casosError } = await supabase
        .from("casos")
        .select(`
          id,
          estado_general,
          hecho_id,
          victima_id,
          victimas (
            id,
            nombre_completo
          ),
          hechos (
            id,
            fecha_hecho,
            municipio,
            provincia
          )
        `)
        .order("created_at", { ascending: false })

      if (casosError) throw casosError

      console.log("[v0] Total casos fetched:", casosData?.length)

      // Group casos by hecho_id to count victims per incident
      const hechoVictimCounts: Record<string, number> = {}
      for (const caso of casosData || []) {
        if (caso.hecho_id) {
          hechoVictimCounts[caso.hecho_id] = (hechoVictimCounts[caso.hecho_id] || 0) + 1
        }
      }

      const transformedCases: CaseData[] = await Promise.all(
        (casosData || []).map(async (caso: any) => {
          const victima = caso.victimas || {}
          const hecho = caso.hechos || {}

          const { data: seguimientoData, error: segError } = await supabase
            .from("seguimiento")
            .select("lista_contactos_familiares")
            .eq("hecho_id", caso.hecho_id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle()

          console.log("[v0] Seguimiento for hecho_id", caso.hecho_id, ":", seguimientoData)
          if (segError && segError.code !== "PGRST116") {
            console.log("[v0] Error fetching seguimiento:", segError)
          }

          let familyContactName = "No especificado"
          let familyRelationship = ""
          let familyContactPhone = "No especificado"

          if (seguimientoData?.lista_contactos_familiares) {
            const contactos = seguimientoData.lista_contactos_familiares as any[]
            if (contactos && contactos.length > 0) {
              const primerContacto = contactos[0]
              familyContactName = primerContacto.nombre || "No especificado"
              familyRelationship = primerContacto.parentesco || ""
              familyContactPhone = (primerContacto.telefono && primerContacto.telefono.trim()) || "No especificado"
            }
          }

          return {
            id: caso.id,
            victimName: victima.nombre_completo || "Sin nombre",
            incidentDate: hecho.fecha_hecho || new Date().toISOString(),
            location: hecho.municipio || "No especificado",
            province: hecho.provincia || "No especificado",
            status:
              caso.estado_general && caso.estado_general.trim() !== ""
                ? caso.estado_general
                : "En investigación",
            familyContactName,
            familyRelationship,
            familyContactPhone,
            hechoId: caso.hecho_id,
            totalVictimsInHecho: caso.hecho_id ? hechoVictimCounts[caso.hecho_id] : 1,
          }
        }),
      )

      console.log("[v0] Transformed cases sample:", transformedCases.slice(0, 2))
      setCases(transformedCases)
    } catch (err) {
      console.error("Error fetching cases:", err)
      setError("Error al cargar los casos")
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...cases]

    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase()
      filtered = filtered.filter(
        (caseData) =>
          caseData.victimName.toLowerCase().includes(searchLower) ||
          caseData.location.toLowerCase().includes(searchLower) ||
          caseData.province.toLowerCase().includes(searchLower),
      )
    }

    if (filters.dateFrom) {
      filtered = filtered.filter((caseData) => caseData.incidentDate >= filters.dateFrom)
    }
    if (filters.dateTo) {
      filtered = filtered.filter((caseData) => caseData.incidentDate <= filters.dateTo)
    }

    if (filters.province) {
      filtered = filtered.filter((caseData) => caseData.province === filters.province)
    }

    if (filters.location) {
      const locationLower = filters.location.toLowerCase()
      filtered = filtered.filter((caseData) => caseData.location.toLowerCase().includes(locationLower))
    }

    if (filters.status) {
      filtered = filtered.filter((caseData) => caseData.status === filters.status)
    }

    setFilteredCases(filtered)
    setCurrentPage(1)
  }

  const handleFiltersChange = (newFilters: typeof filters) => {
    setFilters(newFilters)
  }

  const totalPages = Math.ceil(filteredCases.length / casesPerPage)
  const startIndex = (currentPage - 1) * casesPerPage
  const endIndex = startIndex + casesPerPage
  const currentCases = filteredCases.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-600">Cargando casos...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold text-slate-900 font-heading mb-4">Error</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">{error}</p>
          <Button onClick={fetchCases} className="bg-blue-600 hover:bg-blue-700">
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="outline" className="flex items-center gap-2 bg-transparent">
              <ArrowLeft className="w-4 h-4" />
              Volver al Inicio
            </Button>
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 font-heading mb-2">Todos los Casos</h1>
        <p className="text-lg text-slate-600">
          Base de datos completa de víctimas - {filteredCases.length} casos encontrados
        </p>
      </div>

      <CasesFilters onFiltersChange={handleFiltersChange} />

      {filteredCases.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">No se encontraron casos</h2>
          <p className="text-slate-600 mb-4">
            {filters.searchTerm || Object.values(filters).some(Boolean)
              ? "Intenta ajustar los filtros de búsqueda"
              : "No hay casos disponibles para mostrar"}
          </p>
          {(filters.searchTerm || Object.values(filters).some(Boolean)) && (
            <Button
              variant="outline"
              onClick={() => {
                setFilters({
                  dateFrom: "",
                  dateTo: "",
                  province: "",
                  location: "",
                  status: "",
                  assignedMember: "",
                  searchTerm: "",
                })
              }}
            >
              Limpiar Filtros
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {currentCases.map((caseData) => (
              <CaseCard key={caseData.id} case={caseData} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => goToPage(pageNum)}
                      className="w-10"
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
