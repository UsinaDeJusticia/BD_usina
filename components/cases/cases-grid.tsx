"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, User, Search, Loader2, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatDateUTC } from "@/lib/utils"

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

interface CasesGridProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    province?: string
    location?: string
    status?: string
    familyContact?: string
    searchTerm?: string
  }
}

export function CasesGrid({ filters = {} }: CasesGridProps) {
  const [cases, setCases] = useState<CaseData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchCases()
  }, [])

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
          created_at,
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

          if (segError && segError.code !== "PGRST116") {
            console.log("[v0] Error fetching seguimiento:", segError)
          }

          let familyContactName = "No especificado"
          let familyRelationship = "Familiar"
          let familyContactPhone = "No especificado"

          if (seguimientoData?.lista_contactos_familiares) {
            const contactos = seguimientoData.lista_contactos_familiares as any[]
            if (contactos && contactos.length > 0) {
              const primerContacto = contactos[0]
              familyContactName = primerContacto.nombre || "No especificado"
              familyRelationship = primerContacto.parentesco || "Familiar"
              const telefono = primerContacto.telefono
              familyContactPhone = telefono && telefono.trim() !== "" ? telefono : "No especificado"
            }
          }

          return {
            id: caso.id,
            victimName: victima.nombre_completo || "Sin nombre",
            incidentDate: hecho.fecha_hecho || new Date().toISOString(),
            location: hecho.municipio || hecho.provincia || "No especificado",
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

      setCases(transformedCases)
    } catch (err) {
      console.error("Error fetching cases:", err)
      setError("Error al cargar los casos")
    } finally {
      setIsLoading(false)
    }
  }

  const filteredCases = cases.filter((case_) => {
    // Date range filter
    if (filters.dateFrom) {
      const caseDate = new Date(case_.incidentDate)
      const fromDate = new Date(filters.dateFrom)
      if (caseDate < fromDate) return false
    }

    if (filters.dateTo) {
      const caseDate = new Date(case_.incidentDate)
      const toDate = new Date(filters.dateTo)
      if (caseDate > toDate) return false
    }

    // Province filter
    if (filters.province && case_.province !== filters.province) {
      return false
    }

    // Location filter (partial match)
    if (filters.location && !case_.location.toLowerCase().includes(filters.location.toLowerCase())) {
      return false
    }

    // Status filter
    if (filters.status && case_.status !== filters.status) {
      return false
    }

    // Family contact filter
    if (
      filters.familyContact &&
      !`${case_.familyContactName} - ${case_.familyRelationship}`
        .toLowerCase()
        .includes(filters.familyContact.toLowerCase())
    ) {
      return false
    }

    // Search term filter (searches in victim name and location)
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase()
      const matchesName = case_.victimName.toLowerCase().includes(searchLower)
      const matchesLocation = case_.location.toLowerCase().includes(searchLower)
      if (!matchesName && !matchesLocation) {
        return false
      }
    }

    return true
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Cargando casos...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Search className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">Error al cargar casos</h3>
        <p className="text-slate-600 mb-4">{error}</p>
        <button onClick={fetchCases} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Reintentar
        </button>
      </div>
    )
  }

  if (filteredCases.length === 0) {
    return (
      <div className="text-center py-12">
        <Search className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">No se encontraron casos</h3>
        <p className="text-slate-600 mb-4">
          {Object.keys(filters).some((key) => filters[key as keyof typeof filters]) && (
            <span className="ml-2 text-slate-500">(filtrados)</span>
          )}
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-slate-600">
          Mostrando {filteredCases.length} de {cases.length} casos
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredCases.map((case_) => (
          <Link key={case_.id} href={`/casos/${case_.id}`}>
            <Card className="h-full hover:shadow-lg transition-shadow duration-200 border-slate-200 hover:border-slate-300 cursor-pointer">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg text-slate-900 font-heading mb-2 line-clamp-2">
                      {case_.victimName}
                    </h3>
                    <Badge className={`text-xs ${getStatusColor(case_.status)}`}>{case_.status}</Badge>
                  </div>

                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{formatDateUTC(case_.incidentDate)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="line-clamp-1">{case_.location}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="line-clamp-1">
                        {case_.familyContactName} - {case_.familyRelationship}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 text-slate-400 text-center">📞</span>
                      <span className="line-clamp-1 font-mono text-xs">{case_.familyContactPhone}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="line-clamp-1">{case_.totalVictimsInHecho} víctimas</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
