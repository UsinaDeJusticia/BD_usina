"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Phone, User, ChevronRight, LayoutGrid, Play, Filter, Plus, Briefcase, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

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
  fotoPerfil: string | null
}

const getStatusStyles = (estado = "") => {
  const normalized = estado.toLowerCase()
  if (normalized.includes("investigación")) return "bg-yellow-100 text-yellow-700 border-yellow-200"
  if (normalized.includes("cerrado") || normalized.includes("archivado")) return "bg-gray-100 text-gray-600 border-gray-200"
  if (normalized.includes("sentencia")) return "bg-green-100 text-green-700 border-green-200"
  if (normalized.includes("pendiente")) return "bg-orange-50 text-orange-600 border-orange-100"
  return "bg-slate-100 text-slate-600 border-slate-200"
}

interface VictimCardProps {
  caso: CaseData
}

const VictimCard = ({ caso }: VictimCardProps) => {
  return (
    <Link href={`/casos/${caso.id}`}>
      <div className="
        group relative 
        w-[260px] h-[380px] flex-shrink-0 
        bg-white 
        rounded-xl border border-slate-200
        shadow-sm hover:shadow-lg
        overflow-hidden 
        transition-all duration-300 ease-out
        cursor-pointer
      ">
        
        <div className="relative h-[65%] w-full overflow-hidden bg-gradient-to-br from-blue-100 to-blue-200">
          <div className="absolute top-3 left-3 z-20">
            <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border backdrop-blur-sm shadow-sm ${getStatusStyles(caso.status)}`}>
              {caso.status || "Desconocido"}
            </span>
          </div>

          {caso.fotoPerfil ? (
            <img 
              src={caso.fotoPerfil}
              alt={`Foto de ${caso.victimName}`}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-white/80 flex items-center justify-center">
                <User className="w-10 h-10 text-blue-400" />
              </div>
            </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        <div className="h-[35%] w-full bg-white p-4 flex flex-col justify-between border-t border-slate-100">
          <div>
            <h3 className="font-sans text-base font-bold text-slate-900 leading-tight mb-1 truncate group-hover:text-blue-700 transition-colors">
              {caso.victimName || "NOMBRE NO DISPONIBLE"}
            </h3>
            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-3 truncate">
              {caso.location || "Ubicación no especificada"}
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-600">
                <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <p className="text-xs font-medium truncate">
                  {caso.familyContactName || "Familiar no especificado"}
                </p>
              </div>

              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <p className="text-xs font-mono text-slate-500 truncate">
                  {caso.familyContactPhone || "Sin teléfono"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

interface CarouselRowProps {
  data: CaseData[]
  direction: "left" | "right"
  duration: number
}

const CarouselRow = ({ data = [], direction = "left", duration = 50 }: CarouselRowProps) => {
  if (!data || data.length === 0) return null

  const infiniteItems = useMemo(() => {
    const itemsNeeded = 20
    const copies = Math.ceil(itemsNeeded / data.length) + 2
    return Array(copies).fill(data).flat()
  }, [data])

  return (
    <div className="relative w-full overflow-hidden py-2 group/row">
       <style>{`
         @keyframes marquee-left { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
         @keyframes marquee-right { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
         .animate-marquee-left { animation: marquee-left ${duration}s linear infinite; }
         .animate-marquee-right { animation: marquee-right ${duration}s linear infinite; }
         .group\\/row:hover .pause-on-hover { animation-play-state: paused; }
       `}</style>

       <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#F9FAFB] to-transparent z-20 pointer-events-none" />
       <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#F9FAFB] to-transparent z-20 pointer-events-none" />

       <div className={`flex gap-5 w-max pause-on-hover ${direction === "left" ? "animate-marquee-left" : "animate-marquee-right"} group/list`}>
        {infiniteItems.map((caso, index) => (
          <div key={`${caso.id}-${index}-${direction}`} className="flex-shrink-0 transition-opacity duration-300 hover:opacity-100 group-hover/list:opacity-50 hover:!opacity-100">
            <VictimCard caso={caso} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function AnimatedCasesGrid() {
  const [cases, setCases] = useState<CaseData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<"animated" | "grid">("animated")
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
            nombre_completo,
            foto_perfil
          ),
          hechos (
            id,
            fecha_hecho,
            municipio,
            provincia
          )
        `)
        .order("created_at", { ascending: false })

      if (casosError) {
        console.error("Supabase query error:", casosError)
        throw casosError
      }

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
            console.log("Error fetching seguimiento:", segError)
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

          const finalStatus =
            caso.estado_general && caso.estado_general.trim() !== ""
              ? caso.estado_general
              : "En investigación"

          return {
            id: caso.id,
            victimName: victima.nombre_completo || "Sin nombre",
            incidentDate: hecho.fecha_hecho || new Date().toISOString(),
            location: hecho.municipio || hecho.provincia || "No especificado",
            province: hecho.provincia || "No especificado",
            fotoPerfil: victima.foto_perfil || null,
            status: finalStatus,
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
      const errorMessage = err instanceof Error ? err.message : String(err)
      const errorDetails = err instanceof Error && err.stack ? err.stack : "No stack available"
      console.error("Error fetching cases:", { message: errorMessage, details: err, stack: errorDetails })
      setError(`Error al cargar los casos: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

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
          {error || "No hay casos disponibles para mostrar"}
        </p>
        {error && (
          <button onClick={fetchCases} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Reintentar
          </button>
        )}
      </div>
    )
  }

  const row1Data = cases
  const row2Data = [...cases].reverse()

  return (
    <div className="w-full flex flex-col items-center bg-[#F9FAFB] py-8"> 
      
      <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
        <Link href="/casos/nuevo">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 shadow-sm shadow-blue-200 transition-colors">
            <Plus className="w-4 h-4" /> Añadir Nuevo Caso
          </button>
        </Link>

        <div className="h-6 w-px bg-slate-300 mx-1 hidden sm:block"></div>

        <button 
          onClick={() => setActiveView("animated")}
          className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${
            activeView === "animated" ? "bg-blue-100 text-blue-700" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Play className="w-4 h-4 fill-current" /> Vista Animada
        </button>

        <button 
          onClick={() => setActiveView("grid")}
          className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${
            activeView === "grid" ? "bg-blue-100 text-blue-700" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <LayoutGrid className="w-4 h-4" /> Vista de Grilla
        </button>

        <button className="px-4 py-2 rounded-md text-sm font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 flex items-center gap-2">
          <Filter className="w-4 h-4" /> Mostrar Filtros
        </button>
      </div>

      {activeView === "animated" ? (
        <div className="w-full flex flex-col gap-6 pb-8 overflow-hidden">
          <div className="container mx-auto px-4 mb-2">
             <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
               <Briefcase className="w-5 h-5 text-slate-400" />
               Casos Destacados ({cases.length})
             </h2>
          </div>

          {cases.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <p>No hay casos disponibles para mostrar.</p>
            </div>
          ) : (
            <>
              <CarouselRow data={row1Data} direction="left" duration={80} />
              <CarouselRow data={row2Data} direction="right" duration={90} />
            </>
          )}
          
          <div className="mt-4 flex justify-center items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-widest animate-pulse cursor-pointer hover:text-blue-600 transition-colors">
              <span>Desliza para explorar</span>
              <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      ) : (
        <div className="container mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
           {cases.map(caso => <VictimCard key={caso.id} caso={caso} />)}
        </div>
      )}
    </div>
  )
}
