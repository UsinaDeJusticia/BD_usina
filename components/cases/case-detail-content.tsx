"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  Edit,
  Trash2,
  ArrowLeft,
  Calendar,
  User,
  Phone,
  FileText,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Users,
  Gavel,
  Building,
  Heart,
  Scale,
  Download,
  ImageIcon,
  File,
  Video,
  Newspaper,
  Mic,
  Share2,
  Paperclip,
  Eye,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { createClient } from "@/lib/supabase/client"
import { FilePreviewDialog } from "@/components/ui/file-preview-dialog"
import { formatDateUTC } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/queries/keys"

interface CaseDetailContentProps {
  caseId: string
}

interface Victima {
  id: string
  nombre_completo: string | null
  edad: number | null
  fecha_nacimiento: string | null
  profesion: string | null
  nacionalidad: string | null
  redes_sociales: string | null
  notas_adicionales: string | null
  provincia_residencia: string | null
  municipio_residencia: string | null
  fecha_hecho: string | null
  fecha_fallecimiento: string | null
}

interface Hecho {
  id: string
  victima_id: string | null
  fecha_hecho: string | null
  fecha_fallecimiento: string | null
  municipio: string | null
  provincia: string | null
  localidad_barrio: string | null
  tipo_lugar: string | null
  lugar_otro: string | null
  tipo_crimen: string | null
  tipo_arma: string | null
  resumen_hecho: string | null
  numero_causa: string | null
  caratula: string | null
  telefono_fiscalia: string | null
  email_fiscalia: string | null
}

interface InstanciaJudicial {
  id: string
  orden_nivel: string | null
  numero_causa: string | null
  caratula: string | null
  fiscal: string | null
  fiscalia: string | null
}

interface Imputado {
  id: string
  apellido_nombre: string | null
  nacionalidad: string | null
  documento_identidad: string | null
  edad: string | null
  alias: string | null
  menor_edad: boolean | null
  estado_procesal: string | null
  juzgado_ufi: string | null
  tribunal_fallo: string | null
  juicio_abreviado: boolean | null
  pena: string | null
  prision_perpetua: boolean | null
  fecha_veredicto: string | null
  es_extranjero: boolean | null
  detenido_previo: boolean | null
  fallecido: boolean | null
  es_reincidente: boolean | null
  cargos: string | null
  instancias_judiciales: InstanciaJudicial[]
}

interface Seguimiento {
  id: string
  primer_contacto: boolean | null
  como_llego_caso: string | null
  miembro_asignado: string | null
  contacto_familia: string | null
  parentesco_contacto: string | null
  parentesco_otro: string | null
  telefono_contacto: string | null
  email_contacto: string | null
  direccion_contacto: string | null
  tipo_acompanamiento: string[] | null
  abogado_querellante: string | null
  amicus_curiae: boolean | null
  notas_seguimiento: string | null
  proximas_acciones: string | null
}

interface Recurso {
  id: string
  tipo: string | null
  titulo: string | null
  descripcion: string | null
  url: string | null
  fuente: string | null
  archivo_path: string | null
  archivo_nombre: string | null
  archivo_tipo: string | null
  archivo_size: number | null
  victima_id: string | null
  hecho_id: string | null
  imputado_id: string | null
}

interface HermanoHecho {
  caso_id: string
  victima_id: string
  victima_nombre: string | null
}

interface CaseData {
  caso_id: string
  victima: Victima
  hecho: Hecho | null
  imputados: Imputado[]
  seguimiento: Seguimiento | null
  recursos: Recurso[]
  hermanos_hecho: HermanoHecho[]
  estado_general: string | null
  estado: string | null
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
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

const getResourceTypeIcon = (tipo: string | null, archivoTipo: string | null) => {
  if (archivoTipo?.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-green-600" />
  if (archivoTipo?.includes("pdf")) return <File className="w-4 h-4 text-red-600" />

  switch (tipo?.toLowerCase()) {
    case "noticia":
      return <Newspaper className="w-4 h-4 text-blue-600" />
    case "video":
      return <Video className="w-4 h-4 text-purple-600" />
    case "foto":
    case "imagen":
      return <ImageIcon className="w-4 h-4 text-green-600" />
    case "documento":
      return <FileText className="w-4 h-4 text-amber-600" />
    case "resolución judicial":
      return <Scale className="w-4 h-4 text-slate-600" />
    case "audio":
      return <Mic className="w-4 h-4 text-pink-600" />
    case "red social":
      return <Share2 className="w-4 h-4 text-cyan-600" />
    default:
      return <Paperclip className="w-4 h-4 text-slate-500" />
  }
}

interface ResourceViewerProps {
  recursos: Recurso[]
  getFileUrl: (path: string) => string
  title?: string
}

function ResourceViewer({ recursos, getFileUrl, title = "Recursos Adjuntos" }: ResourceViewerProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<{
    url: string
    tipo: string
    titulo: string
    archivoTipo?: string
  } | null>(null)

  if (recursos.length === 0) return null

  const handlePreview = (recurso: Recurso) => {
    const url = recurso.archivo_path ? getFileUrl(recurso.archivo_path) : recurso.url || ""
    setPreviewData({
      url,
      tipo: recurso.tipo || "",
      titulo: recurso.titulo || recurso.archivo_nombre || "Sin título",
      archivoTipo: recurso.archivo_tipo,
    })
    setPreviewOpen(true)
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <Paperclip className="w-4 h-4" />
        {title} ({recursos.length})
      </h4>
      <div className="space-y-2">
        {recursos.map((recurso) => (
          <div
            key={recurso.id}
            className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="p-2 bg-white rounded-lg border border-slate-200">
              {getResourceTypeIcon(recurso.tipo, recurso.archivo_tipo)}
            </div>
            <div className="flex-1 min-w-0">
              <button
                onClick={() => handlePreview(recurso)}
                className="font-medium text-slate-900 text-sm truncate hover:text-blue-600 hover:underline text-left"
              >
                {recurso.titulo || recurso.archivo_nombre || "Sin título"}
              </button>
              <div className="flex items-center gap-2 mt-1">
                {recurso.tipo && (
                  <Badge variant="outline" className="text-xs">
                    {recurso.tipo}
                  </Badge>
                )}
                {recurso.fuente && <span className="text-xs text-slate-500">Fuente: {recurso.fuente}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* Botón Ver/Preview */}
              <button
                onClick={() => handlePreview(recurso)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                title="Ver archivo"
              >
                <Eye className="w-3 h-3" />
                Ver
              </button>
              {/* Botón Descargar */}
              {recurso.archivo_path ? (
                <a
                  href={getFileUrl(recurso.archivo_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-200 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-300 transition-colors"
                  title="Descargar"
                >
                  <Download className="w-3 h-3" />
                </a>
              ) : recurso.url ? (
                <a
                  href={recurso.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-200 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-300 transition-colors"
                  title="Abrir enlace externo"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de preview */}
      {previewData && (
        <FilePreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          url={previewData.url}
          tipo={previewData.tipo}
          titulo={previewData.titulo}
          archivoTipo={previewData.archivoTipo}
        />
      )}
    </div>
  )
}

export function CaseDetailContent({ caseId }: CaseDetailContentProps) {
  const [caseData, setCaseData] = useState<CaseData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    fetchCaseData()
  }, [caseId])

  const fetchCaseData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Strategy 1: Find by caso.id (new structure)
      const { data: casosArray } = await supabase
        .from("casos")
        .select("id, victima_id, hecho_id, estado_general, estado")
        .eq("id", caseId)

      if (casosArray && casosArray.length > 0) {
        await loadCaseWithData(casosArray[0])
        return
      }

      // Strategy 2: Find by victima.id (legacy cases)
      const { data: victimasArray } = await supabase.from("victimas").select("*").eq("id", caseId)

      if (victimasArray && victimasArray.length > 0) {
        await loadLegacyCase(victimasArray[0])
        return
      }

      // Strategy 3: Find by hecho.id
      const { data: hechosArray } = await supabase.from("hechos").select("*, victimas(*)").eq("id", caseId)

      if (hechosArray && hechosArray.length > 0) {
        await loadLegacyCaseFromHecho(hechosArray[0])
        return
      }

      setError("Caso no encontrado")
    } catch (err: any) {
      console.error("Error fetching case data:", err.message)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const loadLegacyCase = async (victimaData: any) => {
    const { data: hechosArray } = await supabase.from("hechos").select("*").eq("victima_id", victimaData.id)
    const hechoData = hechosArray?.[0] || null

    let casoId = victimaData.id
    let estadoGeneral = "En investigación"
    let estado = null

    if (hechoData) {
      const { data: casosArray } = await supabase
        .from("casos")
        .select("id, estado_general, estado")
        .eq("hecho_id", hechoData.id)
        .limit(1)

      if (casosArray && casosArray.length > 0) {
        casoId = casosArray[0].id
        estadoGeneral = casosArray[0].estado_general || estadoGeneral
        estado = casosArray[0].estado
      }
    }

    await loadFullCaseData(casoId, victimaData, hechoData, estadoGeneral, estado)
  }

  const loadLegacyCaseFromHecho = async (hechoData: any) => {
    const victimaData = hechoData.victimas || null

    let casoId = victimaData?.id || hechoData.id
    let estadoGeneral = "En investigación"
    let estado = null

    const { data: casosArray } = await supabase
      .from("casos")
      .select("id, estado_general, estado")
      .eq("hecho_id", hechoData.id)
      .limit(1)

    if (casosArray && casosArray.length > 0) {
      casoId = casosArray[0].id
      estadoGeneral = casosArray[0].estado_general || estadoGeneral
      estado = casosArray[0].estado
    }

    await loadFullCaseData(casoId, victimaData, hechoData, estadoGeneral, estado)
  }

  const loadCaseWithData = async (casoData: any) => {
    const { data: victimasArray } = await supabase.from("victimas").select("*").eq("id", casoData.victima_id)

    if (!victimasArray || victimasArray.length === 0) {
      setError("Víctima no encontrada")
      return
    }
    const victimaData = victimasArray[0]

    let hechoData = null
    if (casoData.hecho_id) {
      const { data: hechosArray } = await supabase.from("hechos").select("*").eq("id", casoData.hecho_id)
      hechoData = hechosArray?.[0] || null
    }

    await loadFullCaseData(casoData.id, victimaData, hechoData, casoData.estado_general, casoData.estado)
  }

  const loadFullCaseData = async (
    casoId: string,
    victimaData: any,
    hechoData: any,
    estadoGeneral: string | null,
    estado: string | null = null,
  ) => {
    // Stage 1: queries independientes en paralelo.
    // - imputados con instancias_judiciales embebidas (elimina el N+1 anterior)
    // - seguimiento del hecho
    // - hermanos de hecho (otras víctimas del mismo hecho)
    const hechoId: string | undefined = hechoData?.id
    const victimaId: string | undefined = victimaData?.id

    const [imputadosResult, seguimientoResult, hermanosResult] =
      await Promise.all([
        hechoId
          ? supabase
              .from("imputados")
              .select("*, instancias_judiciales(*)")
              .eq("hecho_id", hechoId)
          : Promise.resolve({ data: [] as any[] }),
        hechoId
          ? supabase.from("seguimiento").select("*").eq("hecho_id", hechoId)
          : Promise.resolve({ data: [] as any[] }),
        hechoId && victimaId
          ? supabase
              .from("casos")
              .select("id, victima_id, victimas(nombre_completo)")
              .eq("hecho_id", hechoId)
              .neq("victima_id", victimaId)
          : Promise.resolve({ data: [] as any[] }),
      ])

    const imputadosData: Imputado[] = (imputadosResult.data || []).map(
      (imp: any) => ({
        ...imp,
        instancias_judiciales: imp.instancias_judiciales || [],
      }),
    )

    const seguimientoData: Seguimiento | null =
      (seguimientoResult.data || [])[0] || null

    const hermanosHecho: HermanoHecho[] = (hermanosResult.data || []).map(
      (c: any) => ({
        caso_id: c.id,
        victima_id: c.victima_id,
        victima_nombre: c.victimas?.nombre_completo || "Sin nombre",
      }),
    )

    // Stage 2: un único fetch de recursos para hecho + víctima + imputados.
    // Antes eran 2 + N queries (una por imputado); ahora es 1 sola con `.or()`.
    const imputadoIds = imputadosData.map((i) => i.id)
    const recursosFilters: string[] = []
    if (hechoId) recursosFilters.push(`hecho_id.eq.${hechoId}`)
    if (victimaId) recursosFilters.push(`victima_id.eq.${victimaId}`)
    if (imputadoIds.length) {
      recursosFilters.push(`imputado_id.in.(${imputadoIds.join(",")})`)
    }

    let recursosData: Recurso[] = []
    if (recursosFilters.length) {
      const { data: recursos } = await supabase
        .from("recursos")
        .select("*")
        .or(recursosFilters.join(","))
      recursosData = recursos || []
    }

    // Dedup por id (un recurso puede matchear más de un filtro).
    const uniqueRecursos = recursosData.filter(
      (r, index, self) => index === self.findIndex((t) => t.id === r.id),
    )

    setCaseData({
      caso_id: casoId,
      victima: victimaData || {},
      hecho: hechoData,
      imputados: imputadosData,
      seguimiento: seguimientoData,
      recursos: uniqueRecursos,
      hermanos_hecho: hermanosHecho,
      estado_general: estadoGeneral,
      estado: estado,
    })
  }

  /**
   * Borrado completo de la ficha.
   *
   * Los FK apuntan de `casos` hacia `victimas`/`hechos`, así que borrar
   * sólo la fila de `casos` dejaba huérfanos en BD (víctima, hecho,
   * imputados, recursos) y en storage (archivos adjuntos). Acá se borra
   * todo explícitamente, sin depender de cascades cuya configuración en
   * producción no está versionada.
   *
   * Caso especial: si el hecho es compartido con fichas hermanas
   * (varias víctimas del mismo hecho), sólo se purga lo propio de esta
   * víctima — el hecho, sus imputados y sus archivos siguen en uso.
   */
  const handleDelete = async () => {
    if (!caseData) return
    const run = async (query: PromiseLike<{ error: any }>) => {
      const { error } = await query
      if (error) throw error
    }
    try {
      setIsDeleting(true)

      const victimaId = caseData.victima?.id ?? null
      const hechoId = caseData.hecho?.id ?? null
      const hasSiblings = caseData.hermanos_hecho.length > 0
      const imputadoIds = caseData.imputados.map((i) => i.id)

      // 1. Archivos del bucket. Con hermanos sólo los recursos de la
      //    víctima; sin hermanos, todos los de la ficha. Si el remove
      //    falla seguimos igual: preferimos un archivo huérfano a una
      //    ficha a medio borrar.
      const recursosToPurge = hasSiblings
        ? caseData.recursos.filter((r) => r.victima_id === victimaId)
        : caseData.recursos
      const storagePaths = recursosToPurge
        .map((r) => r.archivo_path)
        .filter((p): p is string => !!p)
      if (storagePaths.length > 0) {
        await supabase.storage.from("archivos-casos").remove(storagePaths)
      }

      // 2. Filas en BD, de hijos a padres.
      if (!hasSiblings && hechoId) {
        if (imputadoIds.length > 0) {
          await run(supabase.from("fechas_juicio").delete().in("imputado_id", imputadoIds))
          await run(supabase.from("instancias_judiciales").delete().in("imputado_id", imputadoIds))
          await run(supabase.from("recursos").delete().in("imputado_id", imputadoIds))
        }
        await run(supabase.from("recursos").delete().eq("hecho_id", hechoId))
        if (victimaId) {
          await run(supabase.from("recursos").delete().eq("victima_id", victimaId))
        }
        await run(supabase.from("imputados").delete().eq("hecho_id", hechoId))
        await run(supabase.from("seguimiento").delete().eq("hecho_id", hechoId))
        await run(supabase.from("casos").delete().eq("hecho_id", hechoId))
        await run(supabase.from("hechos").delete().eq("id", hechoId))
      } else if (victimaId) {
        // Hecho compartido: borrar sólo lo propio de esta víctima.
        await run(supabase.from("recursos").delete().eq("victima_id", victimaId))
        // `hechos.victima_id` tiene ON DELETE CASCADE: si apunta a esta
        // víctima hay que reasignarlo a un hermano antes de borrarla, o
        // el hecho entero (y las fichas hermanas) se irían con ella.
        if (hechoId && caseData.hecho?.victima_id === victimaId) {
          await run(
            supabase
              .from("hechos")
              .update({ victima_id: caseData.hermanos_hecho[0].victima_id })
              .eq("id", hechoId),
          )
        }
        await run(supabase.from("casos").delete().eq("id", caseId))
      }

      if (victimaId) {
        // Cascadea la fila de `casos` (casos.victima_id) si quedara viva.
        await run(supabase.from("victimas").delete().eq("id", victimaId))
      } else {
        await run(supabase.from("casos").delete().eq("id", caseId))
      }

      // Listados y dashboard quedaron stale tras el delete.
      queryClient.invalidateQueries({ queryKey: queryKeys.casesList })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats })
      router.push("/casos")
    } catch (err) {
      console.error("Error deleting case:", err)
      setError("Error al eliminar el caso")
    } finally {
      setIsDeleting(false)
    }
  }

  // El bucket es privado: usar la API route que valida sesion + whitelist
  // y redirecciona a un signed URL temporal. Ver lib/supabase/storage.ts.
  const getFileUrl = (path: string) => {
    const encoded = path.split("/").map(encodeURIComponent).join("/")
    return `/api/files/${encoded}`
  }

  if (isLoading) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-600">Cargando caso...</span>
        </div>
      </main>
    )
  }

  if (error || !caseData) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Error al cargar el caso</h3>
          <p className="text-slate-600 mb-4">{error || "No se pudo encontrar el caso solicitado"}</p>
          <Link href="/casos">
            <Button variant="outline">Volver a Casos</Button>
          </Link>
        </div>
      </main>
    )
  }

  const { victima, hecho, imputados, seguimiento, recursos, hermanos_hecho, estado_general, estado } = caseData

  const getVictimResources = () => recursos.filter((r) => r.victima_id === victima.id && !r.imputado_id)
  const getImputadoResources = (imputadoId: string) => recursos.filter((r) => r.imputado_id === imputadoId)
  const getGeneralResources = () => recursos.filter((r) => !r.victima_id && !r.imputado_id)

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link href="/casos">
            <Button variant="outline" size="sm" className="flex items-center gap-2 bg-transparent">
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{victima.nombre_completo || "Víctima sin nombre"}</h1>
            <div className="flex items-center gap-2 mt-1">
              {(estado || estado_general) && (
                <Badge className={`text-xs ${getStatusColor(estado || estado_general || "")}`}>
                  {estado || estado_general}
                </Badge>
              )}
              {hecho?.tipo_crimen && (
                <Badge variant="outline" className="text-xs">
                  {hecho.tipo_crimen}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href={`/casos/${caseId}/editar`}>
            <Button className="bg-slate-800 hover:bg-slate-700 flex items-center gap-2">
              <Edit className="w-4 h-4" />
              Editar
            </Button>
          </Link>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Confirmar Eliminación
                </AlertDialogTitle>
                <AlertDialogDescription>
                  ¿Está seguro que desea eliminar este caso? Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
                  {isDeleting ? "Eliminando..." : "Eliminar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {hermanos_hecho.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-amber-800 text-base">
              <Users className="w-5 h-5" />
              Otras Víctimas de este Hecho ({hermanos_hecho.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {hermanos_hecho.map((hermano) => (
                <Link key={hermano.caso_id} href={`/casos/${hermano.caso_id}`}>
                  <Badge
                    variant="outline"
                    className="cursor-pointer hover:bg-amber-100 border-amber-300 text-amber-800"
                  >
                    <User className="w-3 h-3 mr-1" />
                    {hermano.victima_nombre}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {/* Victim Information */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-slate-600" />
              Datos de la Víctima
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {victima.nombre_completo && (
                <div>
                  <label className="text-sm font-medium text-slate-500">Nombre Completo</label>
                  <p className="text-slate-900">{victima.nombre_completo}</p>
                </div>
              )}
              {victima.edad && (
                <div>
                  <label className="text-sm font-medium text-slate-500">Edad</label>
                  <p className="text-slate-900">{victima.edad} años</p>
                </div>
              )}
              {victima.fecha_nacimiento && (
                <div>
                  <label className="text-sm font-medium text-slate-500">Fecha de Nacimiento</label>
                  <p className="text-slate-900">{formatDateUTC(victima.fecha_nacimiento)}</p>
                </div>
              )}
              {victima.nacionalidad && (
                <div>
                  <label className="text-sm font-medium text-slate-500">Nacionalidad</label>
                  <p className="text-slate-900">{victima.nacionalidad}</p>
                </div>
              )}
              {victima.profesion && (
                <div>
                  <label className="text-sm font-medium text-slate-500">Profesión</label>
                  <p className="text-slate-900">{victima.profesion}</p>
                </div>
              )}
              {(victima.provincia_residencia || victima.municipio_residencia) && (
                <div>
                  <label className="text-sm font-medium text-slate-500">Residencia</label>
                  <p className="text-slate-900">
                    {[victima.municipio_residencia, victima.provincia_residencia].filter(Boolean).join(", ")}
                  </p>
                </div>
              )}
              {victima.redes_sociales && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-500">Redes Sociales</label>
                  <p className="text-slate-900">{victima.redes_sociales}</p>
                </div>
              )}
            </div>
            {victima.notas_adicionales && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <label className="text-sm font-medium text-slate-500">Notas Adicionales</label>
                <p className="text-slate-900 mt-1">{victima.notas_adicionales}</p>
              </div>
            )}

            <ResourceViewer recursos={getVictimResources()} getFileUrl={getFileUrl} title="Documentos de la Víctima" />
          </CardContent>
        </Card>

        {/* Incident Information */}
        {hecho && (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-slate-600" />
                Información del Hecho
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {hecho.fecha_hecho && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">Fecha del Hecho</label>
                    <p className="text-slate-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {formatDateUTC(hecho.fecha_hecho)}
                    </p>
                  </div>
                )}
                {hecho.fecha_fallecimiento && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">Fecha de Fallecimiento</label>
                    <p className="text-slate-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {formatDateUTC(hecho.fecha_fallecimiento)}
                    </p>
                  </div>
                )}
                {hecho.tipo_crimen && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">Tipo de Crimen</label>
                    <p className="text-slate-900">{hecho.tipo_crimen}</p>
                  </div>
                )}
                {hecho.tipo_arma && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">Tipo de Arma/Medio</label>
                    <p className="text-slate-900">{hecho.tipo_arma}</p>
                  </div>
                )}
                {hecho.provincia && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">Provincia</label>
                    <p className="text-slate-900">{hecho.provincia}</p>
                  </div>
                )}
                {hecho.municipio && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">Municipio</label>
                    <p className="text-slate-900">{hecho.municipio}</p>
                  </div>
                )}
                {hecho.localidad_barrio && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">Localidad/Barrio</label>
                    <p className="text-slate-900">{hecho.localidad_barrio}</p>
                  </div>
                )}
                {hecho.tipo_lugar && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">Tipo de Lugar</label>
                    <p className="text-slate-900">{hecho.tipo_lugar}</p>
                  </div>
                )}
              </div>
              {hecho.resumen_hecho && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <label className="text-sm font-medium text-slate-500">Resumen del Hecho</label>
                  <p className="text-slate-900 mt-1 whitespace-pre-wrap">{hecho.resumen_hecho}</p>
                </div>
              )}
              {(hecho.numero_causa || hecho.caratula || hecho.telefono_fiscalia || hecho.email_fiscalia) && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Scale className="w-4 h-4" />
                    Información Judicial
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {hecho.numero_causa && (
                      <div>
                        <label className="text-sm font-medium text-slate-500">Número de Causa</label>
                        <p className="text-slate-900">{hecho.numero_causa}</p>
                      </div>
                    )}
                    {hecho.caratula && (
                      <div>
                        <label className="text-sm font-medium text-slate-500">Carátula</label>
                        <p className="text-slate-900">{hecho.caratula}</p>
                      </div>
                    )}
                    {hecho.telefono_fiscalia && (
                      <div>
                        <label className="text-sm font-medium text-slate-500">Teléfono Fiscalía</label>
                        <p className="text-slate-900">{hecho.telefono_fiscalia}</p>
                      </div>
                    )}
                    {hecho.email_fiscalia && (
                      <div>
                        <label className="text-sm font-medium text-slate-500">Email Fiscalía</label>
                        <p className="text-slate-900">{hecho.email_fiscalia}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Imputados */}
        {imputados.length > 0 && (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-slate-600" />
                Imputados ({imputados.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {imputados.map((imputado, index) => (
                  <AccordionItem key={imputado.id} value={imputado.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <span className="font-medium">{imputado.apellido_nombre || `Imputado #${index + 1}`}</span>
                        {imputado.estado_procesal && (
                          <Badge variant="outline" className="text-xs">
                            {imputado.estado_procesal}
                          </Badge>
                        )}
                        {imputado.fallecido && (
                          <Badge variant="destructive" className="text-xs">
                            Fallecido
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pl-4 space-y-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          {imputado.documento_identidad && (
                            <div>
                              <span className="font-medium text-slate-500">DNI:</span>{" "}
                              <span className="text-slate-900">{imputado.documento_identidad}</span>
                            </div>
                          )}
                          {imputado.nacionalidad && (
                            <div>
                              <span className="font-medium text-slate-500">Nacionalidad:</span>{" "}
                              <span className="text-slate-900">{imputado.nacionalidad}</span>
                            </div>
                          )}
                          {imputado.edad && (
                            <div>
                              <span className="font-medium text-slate-500">Edad:</span>{" "}
                              <span className="text-slate-900">{imputado.edad}</span>
                            </div>
                          )}
                          {imputado.alias && (
                            <div>
                              <span className="font-medium text-slate-500">Alias:</span>{" "}
                              <span className="text-slate-900">{imputado.alias}</span>
                            </div>
                          )}
                        </div>

                        {/* Flags */}
                        <div className="flex flex-wrap gap-2">
                          {imputado.menor_edad && <Badge variant="secondary">Menor de edad</Badge>}
                          {imputado.es_extranjero && <Badge variant="secondary">Extranjero</Badge>}
                          {imputado.detenido_previo && <Badge variant="secondary">Detenido previo al juicio</Badge>}
                          {imputado.es_reincidente && <Badge variant="secondary">Reincidente</Badge>}
                          {imputado.juicio_abreviado && <Badge variant="secondary">Juicio abreviado</Badge>}
                          {imputado.prision_perpetua && <Badge variant="destructive">Prisión perpetua</Badge>}
                        </div>

                        {/* Legal Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {imputado.juzgado_ufi && (
                            <div>
                              <span className="font-medium text-slate-500">Juzgado/UFI:</span>{" "}
                              <span className="text-slate-900">{imputado.juzgado_ufi}</span>
                            </div>
                          )}
                          {imputado.tribunal_fallo && (
                            <div>
                              <span className="font-medium text-slate-500">Tribunal del Fallo:</span>{" "}
                              <span className="text-slate-900">{imputado.tribunal_fallo}</span>
                            </div>
                          )}
                          {imputado.pena && (
                            <div>
                              <span className="font-medium text-slate-500">Pena:</span>{" "}
                              <span className="text-slate-900">{imputado.pena}</span>
                            </div>
                          )}
                          {imputado.fecha_veredicto && (
                            <div>
                              <span className="font-medium text-slate-500">Fecha Veredicto:</span>{" "}
                              <span className="text-slate-900">{formatDateUTC(imputado.fecha_veredicto)}</span>
                            </div>
                          )}
                          {imputado.cargos && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-slate-500">Cargos:</span>{" "}
                              <span className="text-slate-900">{imputado.cargos}</span>
                            </div>
                          )}
                        </div>

                        {/* Instancias Judiciales */}
                        {imputado.instancias_judiciales.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-100">
                            <h5 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                              <Building className="w-4 h-4" />
                              Instancias Judiciales
                            </h5>
                            <div className="space-y-3">
                              {imputado.instancias_judiciales.map((inst) => (
                                <div key={inst.id} className="bg-slate-50 rounded-lg p-3 text-sm">
                                  <div className="font-medium text-slate-800 mb-2">
                                    {inst.orden_nivel || "Instancia"}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-600">
                                    {inst.numero_causa && (
                                      <div>
                                        <span className="font-medium">Causa:</span> {inst.numero_causa}
                                      </div>
                                    )}
                                    {inst.caratula && (
                                      <div>
                                        <span className="font-medium">Carátula:</span> {inst.caratula}
                                      </div>
                                    )}
                                    {inst.fiscal && (
                                      <div>
                                        <span className="font-medium">Fiscal / Fiscalía:</span> {inst.fiscal}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <ResourceViewer
                          recursos={getImputadoResources(imputado.id)}
                          getFileUrl={getFileUrl}
                          title="Documentos del Imputado"
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* Seguimiento */}
        {seguimiento && (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-slate-600" />
                Seguimiento ONG
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {seguimiento.tipo_acompanamiento && seguimiento.tipo_acompanamiento.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-slate-500">Tipo de Acompañamiento</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {seguimiento.tipo_acompanamiento.map((tipo, i) => (
                      <Badge key={i} variant="secondary">
                        {tipo}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {seguimiento.miembro_asignado && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">Miembro Asignado</label>
                    <p className="text-slate-900">{seguimiento.miembro_asignado}</p>
                  </div>
                )}
                {seguimiento.como_llego_caso && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">Cómo llegó el caso</label>
                    <p className="text-slate-900">{seguimiento.como_llego_caso}</p>
                  </div>
                )}
                {seguimiento.primer_contacto !== null && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">Primer Contacto</label>
                    <p className="text-slate-900">{seguimiento.primer_contacto ? "Sí" : "No"}</p>
                  </div>
                )}
                {seguimiento.abogado_querellante && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">Abogado Querellante</label>
                    <p className="text-slate-900">{seguimiento.abogado_querellante}</p>
                  </div>
                )}
                {seguimiento.amicus_curiae !== null && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">Amicus Curiae</label>
                    <p className="text-slate-900">{seguimiento.amicus_curiae ? "Sí" : "No"}</p>
                  </div>
                )}
              </div>

              {(seguimiento.contacto_familia || seguimiento.telefono_contacto || seguimiento.email_contacto) && (
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Contacto Familiar
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {seguimiento.contacto_familia && (
                      <div>
                        <label className="text-sm font-medium text-slate-500">Nombre</label>
                        <p className="text-slate-900">{seguimiento.contacto_familia}</p>
                      </div>
                    )}
                    {(seguimiento.parentesco_contacto || seguimiento.parentesco_otro) && (
                      <div>
                        <label className="text-sm font-medium text-slate-500">Parentesco</label>
                        <p className="text-slate-900">
                          {seguimiento.parentesco_contacto === "Otro"
                            ? seguimiento.parentesco_otro
                            : seguimiento.parentesco_contacto}
                        </p>
                      </div>
                    )}
                    {seguimiento.telefono_contacto && (
                      <div>
                        <label className="text-sm font-medium text-slate-500">Teléfono</label>
                        <p className="text-slate-900">{seguimiento.telefono_contacto}</p>
                      </div>
                    )}
                    {seguimiento.email_contacto && (
                      <div>
                        <label className="text-sm font-medium text-slate-500">Email</label>
                        <p className="text-slate-900">{seguimiento.email_contacto}</p>
                      </div>
                    )}
                    {seguimiento.direccion_contacto && (
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-slate-500">Dirección</label>
                        <p className="text-slate-900">{seguimiento.direccion_contacto}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {seguimiento.notas_seguimiento && (
                <div className="pt-4 border-t border-slate-100">
                  <label className="text-sm font-medium text-slate-500">Notas de Seguimiento</label>
                  <p className="text-slate-900 mt-1 whitespace-pre-wrap">{seguimiento.notas_seguimiento}</p>
                </div>
              )}
              {seguimiento.proximas_acciones && (
                <div className="pt-4 border-t border-slate-100">
                  <label className="text-sm font-medium text-slate-500">Próximas Acciones</label>
                  <p className="text-slate-900 mt-1 whitespace-pre-wrap">{seguimiento.proximas_acciones}</p>
                </div>
              )}

              <ResourceViewer
                recursos={getGeneralResources()}
                getFileUrl={getFileUrl}
                title="Recursos Generales del Caso"
              />
            </CardContent>
          </Card>
        )}

        {!seguimiento && getGeneralResources().length > 0 && (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-600" />
                Recursos del Caso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResourceViewer recursos={getGeneralResources()} getFileUrl={getFileUrl} title="Recursos Generales" />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
