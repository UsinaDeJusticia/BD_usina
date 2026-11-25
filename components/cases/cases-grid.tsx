"use client"

import { Search, Loader2 } from "lucide-react"
import { type CaseListItem } from "@/lib/data/casos"
import { useCasesList } from "@/lib/queries/casos"
import { usePhotoUrls } from "@/lib/photos/use-photo-urls"
import { CasePhotoCard } from "@/components/cases/case-photo-card"


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
  const { data: cases = [], isLoading, error, refetch } = useCasesList()
  // Un solo request firma todas las fotos del listado.
  const photoUrls = usePhotoUrls(cases.map((c) => c.photoPath))

  const displayLocation = (c: CaseListItem) =>
    c.municipio !== "No especificado" ? c.municipio : c.provincia

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
    if (filters.province && case_.provincia !== filters.province) {
      return false
    }

    // Location filter (partial match)
    if (filters.location && !displayLocation(case_).toLowerCase().includes(filters.location.toLowerCase())) {
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
      const matchesLocation = displayLocation(case_).toLowerCase().includes(searchLower)
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
        <p className="text-slate-600 mb-4">Error al cargar los casos</p>
        <button onClick={() => refetch()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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

      <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredCases.map((case_) => (
          <CasePhotoCard key={case_.id} caseData={case_} photoUrl={case_.photoPath ? photoUrls[case_.photoPath] : null} />
        ))}
      </div>
    </div>
  )
}
