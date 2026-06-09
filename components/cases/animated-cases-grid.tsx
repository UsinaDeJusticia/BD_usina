"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, User, Loader2, Users } from "lucide-react"
import { type CaseListItem } from "@/lib/data/casos"
import { useCasesList } from "@/lib/queries/casos"

type CaseData = CaseListItem

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
      <Card className="w-80 flex-shrink-0 hover:shadow-lg transition-all duration-300 border-slate-200 hover:border-blue-300 cursor-pointer hover:scale-105">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg text-slate-900 font-heading mb-2 line-clamp-2">
                {caseData.victimName}
              </h3>
              <Badge className={`text-xs ${getStatusColor(caseData.status)}`}>{caseData.status}</Badge>
            </div>

            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="line-clamp-1">
                  {caseData.municipio !== "No especificado" ? caseData.municipio : caseData.provincia}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span className="line-clamp-1">
                  {caseData.familyContactName}
                  {caseData.familyRelationship && ` - ${caseData.familyRelationship}`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-4 h-4 text-blue-600 text-center">📞</span>
                <span className="line-clamp-1 font-mono text-xs">{caseData.familyContactPhone}</span>
              </div>

              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="line-clamp-1">{caseData.totalVictimsInHecho} víctimas</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

interface ScrollingRowProps {
  cases: CaseData[]
  direction: "left" | "right"
  speed: number
}

function ScrollingRow({ cases, direction, speed }: ScrollingRowProps) {
  const [duplicatedCases, setDuplicatedCases] = useState<CaseData[]>([])

  useEffect(() => {
    setDuplicatedCases([...cases, ...cases, ...cases])
  }, [cases])

  return (
    <div className="relative overflow-hidden">
      <div
        className={`flex gap-6 ${direction === "left" ? "animate-scroll-left" : "animate-scroll-right"}`}
        style={{
          animationDuration: `${speed}s`,
        }}
      >
        {duplicatedCases.map((caseData, index) => (
          <CaseCard key={`${caseData.id}-${index}`} case={caseData} />
        ))}
      </div>
    </div>
  )
}

export function AnimatedCasesGrid() {
  const { data: cases = [], isLoading, error, refetch } = useCasesList()
  const [rows, setRows] = useState<CaseData[][]>([])

  useEffect(() => {
    if (cases.length > 0) {
      const chunkSize = 4
      const caseRows = []
      for (let i = 0; i < cases.length; i += chunkSize) {
        caseRows.push(cases.slice(i, i + chunkSize))
      }
      setRows(caseRows)
    }
  }, [cases])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Cargando casos...</span>
      </div>
    )
  }

  if (error || cases.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold text-slate-900 font-heading mb-4">Casos Recientes</h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
          {error ? "Error al cargar los casos" : "No hay casos disponibles para mostrar"}
        </p>
        {error && (
          <button onClick={() => refetch()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Reintentar
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8 py-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-slate-900 font-heading mb-4">Casos Recientes</h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">Base de datos de víctimas</p>
      </div>

      <div className="space-y-8">
        {rows.map((rowCases, index) => (
          <ScrollingRow
            key={index}
            cases={rowCases}
            direction={index % 2 === 0 ? "left" : "right"}
            speed={30 + index * 5}
          />
        ))}
      </div>

      <div className="text-center mt-12">
        <Link
          href="/casos"
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Ver Todos los Casos
        </Link>
      </div>
    </div>
  )
}
