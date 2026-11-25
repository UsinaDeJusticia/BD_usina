"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Loader2, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react"
import { CasesFilters } from "@/components/cases/cases-filters"
import { type CaseListItem } from "@/lib/data/casos"
import { useCasesList } from "@/lib/queries/casos"
import { usePhotoUrls } from "@/lib/photos/use-photo-urls"
import { CasePhotoCard } from "@/components/cases/case-photo-card"

export default function CasosPage() {
  const { data: cases = [], isLoading, error, refetch } = useCasesList()
  const [filteredCases, setFilteredCases] = useState<CaseListItem[]>([])
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

  useEffect(() => {
    applyFilters()
  }, [cases, filters])

  const applyFilters = () => {
    let filtered = [...cases]

    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase()
      filtered = filtered.filter(
        (caseData) =>
          caseData.victimName.toLowerCase().includes(searchLower) ||
          caseData.municipio.toLowerCase().includes(searchLower) ||
          caseData.provincia.toLowerCase().includes(searchLower),
      )
    }

    if (filters.dateFrom) {
      filtered = filtered.filter((caseData) => caseData.incidentDate >= filters.dateFrom)
    }
    if (filters.dateTo) {
      filtered = filtered.filter((caseData) => caseData.incidentDate <= filters.dateTo)
    }

    if (filters.province) {
      filtered = filtered.filter((caseData) => caseData.provincia === filters.province)
    }

    if (filters.location) {
      const locationLower = filters.location.toLowerCase()
      filtered = filtered.filter((caseData) => caseData.municipio.toLowerCase().includes(locationLower))
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
  // Sólo se firman las fotos de la página visible (un request).
  const photoUrls = usePhotoUrls(currentCases.map((c) => c.photoPath))

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
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">Error al cargar los casos</p>
          <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700">
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
          <div className="mb-10 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {currentCases.map((caseData) => (
              <CasePhotoCard
                key={caseData.id}
                caseData={caseData}
                photoUrl={caseData.photoPath ? photoUrls[caseData.photoPath] : null}
              />
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
