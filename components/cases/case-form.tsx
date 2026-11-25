"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Save, X, Plus, Trash2, Users } from "lucide-react"
import Link from "next/link"
import { VictimForm } from "./forms/victim-form"
import { IncidentForm } from "./forms/incident-form"
import { AccusedForm } from "./forms/accused-form"
import { FollowUpForm } from "./forms/follow-up-form"
import { ResourcesForm } from "./forms/resources-form"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/queries/keys"
import { findUnsafeResourceUrls } from "@/lib/cases/payloads"
import { saveCase } from "@/lib/cases/save-case"
import { notificarEventoCaso } from "@/lib/notifications/api"

interface CaseFormProps {
  mode: "create" | "edit"
  caseId?: string
}

const getEmptyVictimData = () => ({
  id: null as string | null,
  casoId: null as string | null,
  nombreCompleto: "",
  fechaNacimiento: "",
  edad: "",
  profesion: "",
  redesSociales: "",
  nacionalidad: "",
  notasAdicionales: "",
  provinciaResidencia: "",
  municipioResidencia: "",
  fechaHecho: "",
  fechaFallecimiento: "",
  resources: [] as any[],
})

export function CaseForm({ mode, caseId }: CaseFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("victim")
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(mode === "edit")
  const [resourcesToDelete, setResourcesToDelete] = useState<string[]>([])

  const [formData, setFormData] = useState({
    victims: [getEmptyVictimData()],
    incident: {
      provincia: "",
      municipio: "",
      localidadBarrio: "",
      tipoLugar: "",
      lugarOtro: "",
      resumenHecho: "",
      tipoCrimen: "",
      tipoArma: "",
      estadoCaso: "En investigación",
    },
    accused: [] as any[],
    followUp: {
      otraIntervencion: false,
      otraIntervencionDescripcion: "",
    } as Record<string, any>,
    resources: [] as any[],
  })

  const [realIds, setRealIds] = useState<{
    victimaId: string | null
    hechoId: string | null
    casoId: string | null
  }>({
    victimaId: null,
    hechoId: null,
    casoId: null,
  })

  useEffect(() => {
    if (mode === "edit" && caseId) {
      loadExistingCaseData()
    }
  }, [mode, caseId])

  const loadExistingCaseData = async () => {
    const supabase = createClient()
    setIsLoading(true)

    try {
      let victimaId: string | null = null
      let hechoId: string | null = null
      let casoId: string | null = null

      // Strategy 1: Try to find by caso.id first
      const { data: casoData } = await supabase.from("casos").select("*").eq("id", caseId).maybeSingle()

      if (casoData) {
        casoId = casoData.id
        victimaId = casoData.victima_id
        hechoId = casoData.hecho_id
      } else {
        // Strategy 2: Try to find by victima.id
        const { data: victimaCheck } = await supabase.from("victimas").select("id").eq("id", caseId).maybeSingle()

        if (victimaCheck) {
          victimaId = victimaCheck.id

          const { data: hechoCheck } = await supabase
            .from("hechos")
            .select("id")
            .eq("victima_id", victimaId)
            .maybeSingle()

          if (hechoCheck) {
            hechoId = hechoCheck.id
          }
        } else {
          // Strategy 3: Try to find by hecho.id
          const { data: hechoCheck } = await supabase
            .from("hechos")
            .select("id, victima_id")
            .eq("id", caseId)
            .maybeSingle()

          if (hechoCheck) {
            hechoId = hechoCheck.id
            victimaId = hechoCheck.victima_id
          }
        }
      }

      if (!victimaId) {
        throw new Error("No se pudo encontrar la víctima asociada a este caso.")
      }

      setRealIds({ victimaId, hechoId, casoId })

      let allVictims: any[] = []

      if (hechoId) {
        const { data: allCasosForHecho } = await supabase
          .from("casos")
          .select("id, victima_id, created_at")
          .eq("hecho_id", hechoId)
          .order("created_at", { ascending: true })

        if (allCasosForHecho && allCasosForHecho.length > 0) {
          const orderedVictimIds = allCasosForHecho.map((c) => c.victima_id).filter(Boolean)

          // Fetch all victims data
          const { data: victimsData } = await supabase.from("victimas").select("*").in("id", orderedVictimIds)

          allVictims = await Promise.all(
            orderedVictimIds.map(async (victimId: string) => {
              const v = victimsData?.find((vd: any) => vd.id === victimId)
              if (!v) return null

              const caso = allCasosForHecho.find((c) => c.victima_id === v.id)

              // Fetch victim resources
              const { data: victimResources } = await supabase
                .from("recursos")
                .select("*")
                .eq("victima_id", v.id)
                .is("imputado_id", null)

              return {
                id: v.id,
                casoId: caso?.id || null,
                nombreCompleto: v.nombre_completo || "",
                fechaNacimiento: v.fecha_nacimiento || "",
                edad: v.edad?.toString() || "",
                profesion: v.profesion || "",
                redesSociales: v.redes_sociales || "",
                nacionalidad: v.nacionalidad || "",
                notasAdicionales: v.notas_adicionales || "",
                provinciaResidencia: v.provincia_residencia || "",
                municipioResidencia: v.municipio_residencia || "",
                fechaHecho: v.fecha_hecho || "",
                fechaFallecimiento: v.fecha_fallecimiento || "",
                // undefined si la base todavía no tiene la columna (017): así no se escribe.
                fotoPath: v.foto_path,
                resources: (victimResources || []).map((r: any) => ({
                  id: r.id,
                  tipo: r.tipo || "",
                  titulo: r.titulo || "",
                  url: r.url || "",
                  fuente: r.fuente || "",
                  descripcion: r.descripcion || "",
                  archivo_path: r.archivo_path,
                  archivo_nombre: r.archivo_nombre,
                  archivo_tipo: r.archivo_tipo,
                  archivo_size: r.archivo_size,
                  input_mode: r.archivo_path ? "file" : "url",
                })),
              }
            }),
          )

          allVictims = allVictims.filter(Boolean)
        }
      }

      // If no victims found throughانہوں, fallback to the single victim
      if (allVictims.length === 0) {
        const { data: victimData, error: victimError } = await supabase
          .from("victimas")
          .select("*")
          .eq("id", victimaId)
          .single()

        if (victimError || !victimData) {
          throw new Error("Error al cargar datos de la víctima")
        }

        // Fetch victim resources
        const { data: victimResources } = await supabase
          .from("recursos")
          .select("*")
          .eq("victima_id", victimaId)
          .is("imputado_id", null)

        allVictims = [
          {
            id: victimData.id,
            casoId: casoId,
            nombreCompleto: victimData.nombre_completo || "",
            fechaNacimiento: victimData.fecha_nacimiento || "",
            edad: victimData.edad?.toString() || "",
            profesion: victimData.profesion || "",
            redesSociales: victimData.redes_sociales || "",
            nacionalidad: victimData.nacionalidad || "",
            notasAdicionales: victimData.notas_adicionales || "",
            provinciaResidencia: victimData.provincia_residencia || "",
            municipioResidencia: victimData.municipio_residencia || "",
            fechaHecho: victimData.fecha_hecho || "",
            fechaFallecimiento: victimData.fecha_fallecimiento || "",
            fotoPath: victimData.foto_path,
            resources: (victimResources || []).map((r: any) => ({
              id: r.id,
              tipo: r.tipo || "",
              titulo: r.titulo || "",
              url: r.url || "",
              fuente: r.fuente || "",
              descripcion: r.descripcion || "",
              archivo_path: r.archivo_path,
              archivo_nombre: r.archivo_nombre,
              archivo_tipo: r.archivo_tipo,
              archivo_size: r.archivo_size,
              input_mode: r.archivo_path ? "file" : "url",
            })),
          },
        ]
      }

      // Fetch hecho data
      let hechoData: any = null
      if (hechoId) {
        const { data } = await supabase.from("hechos").select("*").eq("id", hechoId).single()
        hechoData = data
      } else if (victimaId) {
        const { data } = await supabase.from("hechos").select("*").eq("victima_id", victimaId).maybeSingle()
        hechoData = data
        if (data) {
          hechoId = data.id
          setRealIds((prev) => ({ ...prev, hechoId: data.id }))
        }
      }

      // Load seguimiento. `.maybeSingle()` no rompe cuando el hecho aún no
      // tiene una fila de seguimiento (caso real para fichas viejas).
      const { data: seguimientoData } = await supabase.from("seguimiento").select("*").eq("hecho_id", hechoId).maybeSingle()

      // Antes había acá un setFormData parcial sólo de `followUp`; abajo
      // el setFormData completo lo cubre con los mismos campos. Quitado
      // para evitar re-renders y la confusión de mantener dos lugares
      // en sync.

      // Fetch imputados
      let imputadosData: any[] = []
      if (hechoId) {
        const { data } = await supabase.from("imputados").select("*").eq("hecho_id", hechoId)
        imputadosData = data || []
      }

      const imputadosWithResources = await Promise.all(
        imputadosData.map(async (imputado: any) => {
          const { data: imputadoResources } = await supabase.from("recursos").select("*").eq("imputado_id", imputado.id)
          const { data: instanciasData } = await supabase
            .from("instancias_judiciales")
            .select("*")
            .eq("imputado_id", imputado.id)
          const { data: trialDatesData } = await supabase
            .from("fechas_juicio")
            .select("fecha_audiencia")
            .eq("imputado_id", imputado.id)

          return {
            id: imputado.id,
            apellidoNombre: imputado.apellido_nombre || "",
            alias: imputado.alias || "",
            edad: imputado.edad || "",
            menorEdad: imputado.menor_edad || false,
            nacionalidad: imputado.nacionalidad || "",
            juzgadoUfi: imputado.juzgado_ufi || "",
            estadoProcesal: imputado.estado_procesal || "",
            pena: imputado.pena || "",
            juicioAbreviado: imputado.juicio_abreviado || false,
            prisionPerpetua: imputado.prision_perpetua || false,
            fechaVeredicto: imputado.fecha_veredicto || "",
            documentoIdentidad: imputado.documento_identidad || "",
            tribunalFallo: imputado.tribunal_fallo || "",
            esExtranjero: imputado.es_extranjero || false,
            detenidoPrevio: imputado.detenido_previo || false,
            fallecido: imputado.fallecido || false,
            esReincidente: imputado.es_reincidente || false,
            cargos: imputado.cargos || "",
            trialDates: (trialDatesData || []).map((td: any) => td.fecha_audiencia),
            instanciasJudiciales: (instanciasData || []).map((inst: any) => ({
              id: inst.id,
              numeroCausa: inst.numero_causa || "",
              fiscalFiscalia: inst.fiscal_fiscalia || inst.fiscal || "",
              caratula: inst.caratula || "",
              ordenNivel: inst.orden_nivel || "",
            })),
            resources: (imputadoResources || []).map((r: any) => ({
              id: r.id,
              tipo: r.tipo || "",
              titulo: r.titulo || "",
              url: r.url || "",
              fuente: r.fuente || "",
              descripcion: r.descripcion || "",
              archivo_path: r.archivo_path,
              archivo_nombre: r.archivo_nombre,
              archivo_tipo: r.archivo_tipo,
              archivo_size: r.archivo_size,
              input_mode: r.archivo_path ? "file" : "url",
            })),
          }
        }),
      )

      // Fetch recursos generales del hecho
      let recursosGenerales: any[] = []
      if (hechoId) {
        const { data } = await supabase
          .from("recursos")
          .select("*")
          .eq("hecho_id", hechoId)
          .is("imputado_id", null)
          .is("victima_id", null)
        recursosGenerales = data || []
      }

      const listaMiembros = Array.isArray(seguimientoData?.lista_miembros_asignados)
        ? seguimientoData.lista_miembros_asignados
        : []
      const listaContactos = Array.isArray(seguimientoData?.lista_contactos_familiares)
        ? seguimientoData.lista_contactos_familiares
        : []
      const listaAbogados = Array.isArray(seguimientoData?.datos_abogados_querellantes)
        ? seguimientoData.datos_abogados_querellantes
        : []

      setFormData({
        victims: allVictims,
        incident: {
          provincia: hechoData?.provincia || "",
          municipio: hechoData?.municipio || "",
          localidadBarrio: hechoData?.localidad_barrio || "",
          tipoLugar: hechoData?.tipo_lugar || "",
          lugarOtro: hechoData?.lugar_otro || "",
          resumenHecho: hechoData?.resumen_hecho || "",
          tipoCrimen: hechoData?.tipo_crimen || "",
          tipoArma: hechoData?.tipo_arma || "",
          estadoCaso: casoData?.estado || "En investigación",
        },
        accused: imputadosWithResources,
        followUp: {
          miembroAsignado: seguimientoData?.miembro_asignado || "",
          contactoFamiliar: seguimientoData?.contacto_familia || "",
          telefonoContacto: seguimientoData?.telefono_contacto || "",
          tipoAcompanamiento: seguimientoData?.tipo_acompanamiento || [],
          abogadoQuerellante: seguimientoData?.abogado_querellante || "",
          amicusCuriae: seguimientoData?.amicus_curiae || false,
          comoLlegoCaso: seguimientoData?.como_llego_caso || "",
          primerContacto: seguimientoData?.primer_contacto || false,
          notasSeguimiento: seguimientoData?.notas_seguimiento || "",
          emailContacto: seguimientoData?.email_contacto || "",
          direccionContacto: seguimientoData?.direccion_contacto || "",
          telefonoMiembro: seguimientoData?.telefono_miembro || "",
          emailMiembro: seguimientoData?.email_miembro || "",
          fechaAsignacion: seguimientoData?.fecha_asignacion || "",
          proximasAcciones: seguimientoData?.proximas_acciones || "",
          parentescoContacto: seguimientoData?.parentesco_contacto || "",
          parentescoOtro: seguimientoData?.parentesco_otro || "",
          tieneAbogadoQuerellante: seguimientoData?.tiene_abogado_querellante || "ns_nc",
          abogadoUsinaAmicus: seguimientoData?.abogado_usina_amicus || "",
          abogadoAmicusFirmante: seguimientoData?.abogado_amicus_firmante || "",
          listaMiembrosAsignados: listaMiembros,
          listaContactosFamiliares: listaContactos,
          datosAbogadosQuerellantes: listaAbogados,
          otraIntervencion: seguimientoData?.otra_intervencion || false,
          otraIntervencionDescripcion: seguimientoData?.otra_intervencion_descripcion || "",
        },
        resources: recursosGenerales.map((r: any) => ({
          id: r.id,
          tipo: r.tipo || "",
          titulo: r.titulo || "",
          url: r.url || "",
          fuente: r.fuente || "",
          descripcion: r.descripcion || "",
          archivo_path: r.archivo_path,
          archivo_nombre: r.archivo_nombre,
          archivo_tipo: r.archivo_tipo,
          archivo_size: r.archivo_size,
          input_mode: r.archivo_path ? "file" : "url",
        })),
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar los datos del caso",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const markResourceForDeletion = (resourceId: string) => {
    setResourcesToDelete((prev) => [...prev, resourceId])
  }

  const addVictim = () => {
    setFormData((prev) => ({
      ...prev,
      victims: [...prev.victims, getEmptyVictimData()],
    }))
  }

  const removeVictim = (index: number) => {
    if (formData.victims.length <= 1) return
    setFormData((prev) => ({
      ...prev,
      victims: prev.victims.filter((_, i) => i !== index),
    }))
  }

  const updateVictim = (index: number, data: any) => {
    setFormData((prev) => ({
      ...prev,
      victims: prev.victims.map((v, i) => (i === index ? data : v)),
    }))
  }

  const handleSave = async () => {
    // Validación previa: no escribir nada si hay URLs peligrosas/ inválidas.
    const unsafe = findUnsafeResourceUrls(formData)
    if (unsafe.length > 0) {
      toast({
        title: "URL inválida",
        description: `Sólo se aceptan enlaces http:// o https://. Revisá: ${unsafe.slice(0, 3).join(", ")}`,
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const supabase = createClient()
      const { warnings, createdCasoIds } = await saveCase({
        supabase,
        mode,
        caseId,
        formData,
        realIds,
        resourcesToDelete,
      })

      toast({
        title: mode === "edit" ? "Caso actualizado" : "Caso guardado",
        description:
          warnings.length > 0
            ? `Se guardó el caso, pero no se pudo guardar: ${warnings.join(", ")}. Revisá esos datos.`
            : mode === "edit"
              ? "Los cambios han sido guardados correctamente."
              : `Se han registrado ${formData.victims.length} víctima(s) correctamente.`,
        variant: warnings.length > 0 ? "destructive" : undefined,
      })

      // Avisar al resto del equipo (si activaron "casos"). Nunca bloquea.
      if (mode === "create") {
        // Un aviso por hecho, aunque se carguen varias víctimas juntas.
        void notificarEventoCaso(supabase, createdCasoIds[0], "caso_nuevo")
      } else {
        void notificarEventoCaso(supabase, realIds.casoId, "caso_editado")
      }

      // Listados y dashboard quedaron stale tras el insert/update.
      queryClient.invalidateQueries({ queryKey: queryKeys.casesList })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats })

      router.push("/casos")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "No se pudo guardar el caso. Verifique la conexión a la base de datos.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Cargando datos del caso...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/casos">
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-heading">
              {mode === "edit" ? "Editar Caso" : "Nuevo Caso"}
            </h1>
            <p className="text-sm text-slate-500">
              {mode === "edit"
                ? "Modifica los datos del caso existente"
                : "Complete los datos para registrar un nuevo caso"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/casos">
            <Button variant="outline" className="flex items-center gap-2 bg-transparent">
              <X className="w-4 h-4" />
              Cancelar
            </Button>
          </Link>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Guardando..." : "Guardar Caso"}
          </Button>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="bg-slate-50 border-b border-slate-200">
          <CardTitle className="text-lg font-heading">Información del Caso</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="victim" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Víctimas ({formData.victims.length})
              </TabsTrigger>
              <TabsTrigger value="incident">Hecho</TabsTrigger>
              <TabsTrigger value="accused">Imputados</TabsTrigger>
              <TabsTrigger value="followup">Seguimiento</TabsTrigger>
            </TabsList>

            <TabsContent value="victim" className="space-y-6">
              {formData.victims.length > 1 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                  <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Caso con múltiples víctimas</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Este hecho tiene {formData.victims.length} víctimas registradas. Todas comparten el mismo hecho,
                      imputados y seguimiento, pero cada una tiene su propia ficha individual.
                    </p>
                  </div>
                </div>
              )}

              <div className="max-w-4xl mx-auto space-y-6">
                {formData.victims.map((victim, index) => (
                  <Card key={victim.id || index} className="border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-slate-50">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-base font-heading">
                          Víctima #{index + 1}
                          {victim.nombreCompleto && ` - ${victim.nombreCompleto}`}
                        </CardTitle>
                        {mode === "edit" && (
                          <Badge variant={victim.id ? "outline" : "default"} className="text-xs">
                            {victim.id ? "Guardada" : "Nueva"}
                          </Badge>
                        )}
                      </div>
                      {formData.victims.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeVictim(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="pt-4 space-y-6">
                      <VictimForm
                        data={victim}
                        onChange={(data) => updateVictim(index, { ...victim, ...data })}
                        showDates={true}
                      />
                      <div className="border-t pt-6">
                        <h4 className="text-md font-semibold text-slate-900 font-heading mb-2">
                          Recursos de la Víctima
                        </h4>
                        <p className="text-xs text-slate-500 mb-4">
                          Fotos, documentos y enlaces relacionados con esta víctima.
                        </p>
                        <ResourcesForm
                          data={(victim.resources || []).filter(
                            (r: any) => !r.id || r.id.toString().startsWith("temp-"),
                          )}
                          onChange={(resources) => {
                            const savedResources = (victim.resources || []).filter(
                              (r: any) => r.id && typeof r.id === "string" && !r.id.startsWith("temp-"),
                            )
                            updateVictim(index, { ...victim, resources: [...savedResources, ...resources] })
                          }}
                          savedResources={(victim.resources || []).filter(
                            (r: any) => r.id && typeof r.id === "string" && !r.id.startsWith("temp-"),
                          )}
                          onDeleteSavedResource={(resourceId) => {
                            markResourceForDeletion(resourceId)
                            const updatedResources = (victim.resources || []).filter((r: any) => r.id !== resourceId)
                            updateVictim(index, { ...victim, resources: updatedResources })
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Button
                  onClick={addVictim}
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2 border-dashed border-2 py-6 hover:border-slate-400 bg-transparent"
                >
                  <Plus className="w-5 h-5" />
                  Agregar Víctima
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="incident">
              <div className="max-w-4xl mx-auto">
                <IncidentForm
                  data={formData.incident}
                  onChange={(data) => setFormData((prev) => ({ ...prev, incident: data }))}
                  hideDates={true}
                />
              </div>
            </TabsContent>

            <TabsContent value="accused">
              <AccusedForm
                data={formData.accused}
                onChange={(data) => setFormData((prev) => ({ ...prev, accused: data }))}
              />
            </TabsContent>

            <TabsContent value="followup">
              <div className="max-w-4xl mx-auto">
                <FollowUpForm
                  data={formData.followUp}
                  onChange={(data) => setFormData((prev) => ({ ...prev, followUp: data }))}
                  resources={formData.resources}
                  onResourcesChange={(newResources) => {
                    // Keep saved resources (those with non-temp IDs) and add/update new ones
                    const savedResources = formData.resources.filter(
                      (r: any) => r.id && typeof r.id === "string" && !r.id.startsWith("temp-"),
                    )
                    setFormData((prev) => ({ ...prev, resources: [...savedResources, ...newResources] }))
                  }}
                  savedResources={formData.resources.filter(
                    (r: any) => r.id && typeof r.id === "string" && !r.id.startsWith("temp-"),
                  )}
                  onDeleteSavedResource={(resourceId) => {
                    markResourceForDeletion(resourceId)
                    const updatedResources = formData.resources.filter((r: any) => r.id !== resourceId)
                    setFormData((prev) => ({ ...prev, resources: updatedResources }))
                  }}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
