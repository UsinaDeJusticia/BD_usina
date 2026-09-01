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

interface CaseFormProps {
  mode: "create" | "edit"
  caseId?: string
  /**
   * Id de una propuesta de Mapa del Delito (`propuestas_para_usina`).
   * Cuando está presente en modo "create", el form se pre-rellena con los
   * datos del candidato (incluidas sus fuentes como recursos) y, al
   * guardar con éxito, se notifica la decisión "aprobada" de vuelta a
   * MdD vía /api/candidatos/[id]/decidir. Ver lib/mdd/candidatos.ts.
   */
  fromCandidatoId?: string
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
  resources: [],
})

export function CaseForm({ mode, caseId, fromCandidatoId }: CaseFormProps) {
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
    accused: [],
    followUp: {
      otraIntervencion: false,
      otraIntervencionDescripcion: "",
    },
    resources: [],
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

  // Pre-fill desde una propuesta de Mapa del Delito (ver
  // app/casos/nuevo/page.tsx?fromCandidato=<id>). Sólo aplica en modo
  // create; en edit no tiene sentido.
  useEffect(() => {
    if (mode !== "create" || !fromCandidatoId) return

    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch(`/api/candidatos/${fromCandidatoId}`)
        const body = await res.json()
        if (!res.ok) throw new Error(body?.error || "No se pudo cargar el candidato")
        if (cancelled) return

        const candidato = body.data
        // Alias/género no tienen columna propia en `victimas` (ver
        // docs/integracion-mapa-del-delito.md, mapeo candidato→ficha):
        // se anteponen como texto a las notas.
        const notasExtra = [
          candidato.alias ? `Alias: ${candidato.alias}` : null,
          candidato.genero ? `Género (dato del scraper): ${candidato.genero}` : null,
        ]
          .filter(Boolean)
          .join(" — ")

        const recursosDeFuentes = (candidato.fuentes || []).map((f: any) => ({
          tipo: "noticia",
          titulo: f.titulo || f.url,
          url: f.url,
          fuente: f.fuente_medio || "",
          descripcion: "",
          input_mode: "url",
        }))

        setFormData((prev) => ({
          ...prev,
          victims: [
            {
              ...prev.victims[0],
              nombreCompleto: candidato.nombre_completo || "",
              fechaNacimiento: candidato.fecha_nacimiento || "",
              edad: candidato.edad_aproximada?.toString() || "",
              nacionalidad: candidato.nacionalidad || "",
              notasAdicionales: notasExtra || prev.victims[0].notasAdicionales,
              fechaHecho: candidato.fecha_hecho || "",
              fechaFallecimiento: candidato.fecha_fallecimiento || "",
            },
          ],
          incident: {
            ...prev.incident,
            provincia: candidato.provincia || "",
            municipio: candidato.municipio || "",
            resumenHecho: candidato.resumen_corto || "",
            tipoCrimen: candidato.tipo_crimen || "",
            tipoLugar: candidato.tipo_lugar || "",
          },
          resources: recursosDeFuentes,
        }))
      } catch (err) {
        console.error("Error precargando candidato de MdD:", err)
        toast({
          title: "No se pudo precargar el candidato",
          description: err instanceof Error ? err.message : "Error desconocido",
          variant: "destructive",
        })
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, fromCandidatoId])

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

  const buildImputadoInsert = (accused: any, hechoId: string) => ({
    hecho_id: hechoId,
    apellido_nombre: accused.apellidoNombre,
    alias: accused.alias || null,
    edad: accused.edad || null,
    menor_edad: accused.menorEdad || false,
    nacionalidad: accused.nacionalidad || null,
    juzgado_ufi: accused.juzgadoUfi || null,
    estado_procesal: accused.estadoProcesal || null,
    pena: accused.pena || null,
    juicio_abreviado: accused.juicioAbreviado || false,
    prision_perpetua: accused.prisionPerpetua || false,
    fecha_veredicto: accused.fechaVeredicto || null,
    documento_identidad: accused.documentoIdentidad || null,
    tribunal_fallo: accused.tribunalFallo || null,
    es_extranjero: accused.esExtranjero || false,
    detenido_previo: accused.detenidoPrevio || false,
    fallecido: accused.fallecido || false,
    es_reincidente: accused.esReincidente || false,
    cargos: accused.cargos || null,
  })

  // Un recurso es "existente en BD" si su id es un UUID v4 real (36 chars
  // con guiones, no empieza con "temp-"). El resto (null, "", "temp-*",
  // numérico, o con flag isNew) es un recurso recién agregado en el form.
  // Antes esta misma lógica estaba copiada 3 veces en handleSave.
  const isExistingResource = (r: any): boolean =>
    typeof r.id === "string" &&
    r.id.length === 36 &&
    r.id.includes("-") &&
    !r.id.startsWith("temp-")

  // Campos editables de un recurso. Los `archivo_*` no se actualizan acá:
  // si el usuario reemplaza un archivo, el flujo es borrar el recurso
  // viejo (resourcesToDelete) y crear uno nuevo.
  const buildResourceUpdate = (resource: any) => ({
    tipo: resource.tipo && resource.tipo !== "" ? resource.tipo : "other",
    titulo: resource.titulo || resource.archivo_nombre || "Sin título",
    url: resource.url || null,
    fuente: resource.fuente || null,
    descripcion: resource.descripcion || null,
  })

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
    const supabase = createClient()
    setIsSaving(true)

    // Capturado en CREATE MODE para el callback a Mapa del Delito, leído
    // después de que el if/else de guardado termina (ver más abajo, junto
    // al toast de éxito).
    let firstVictimaId: string | null = null

    try {
      if (mode === "edit" && caseId) {
        const hechoId = realIds.hechoId

        if (resourcesToDelete.length > 0) {
          // First, get the file paths to delete from storage
          const { data: resourcesToRemove } = await supabase
            .from("recursos")
            .select("archivo_path")
            .in("id", resourcesToDelete)

          // Delete files from storage
          if (resourcesToRemove && resourcesToRemove.length > 0) {
            const pathsToDelete = resourcesToRemove.map((r) => r.archivo_path).filter((p): p is string => !!p)

            if (pathsToDelete.length > 0) {
              await supabase.storage.from("archivos-casos").remove(pathsToDelete)
            }
          }

          // Delete records from database
          const { error: deleteError } = await supabase.from("recursos").delete().in("id", resourcesToDelete)

          if (deleteError) throw deleteError
        }

        for (const victim of formData.victims) {
          if (victim.id) {
            // Update existing victim
            const { error: victimError } = await supabase
              .from("victimas")
              .update({
                nombre_completo: victim.nombreCompleto || null,
                fecha_nacimiento: victim.fechaNacimiento || null,
                edad: victim.edad ? Number.parseInt(victim.edad) : null,
                profesion: victim.profesion || null,
                redes_sociales: victim.redesSociales || null,
                nacionalidad: victim.nacionalidad || null,
                notas_adicionales: victim.notasAdicionales || null,
                provincia_residencia: victim.provinciaResidencia || null,
                municipio_residencia: victim.municipioResidencia || null,
                fecha_hecho: victim.fechaHecho || null,
                fecha_fallecimiento: victim.fechaFallecimiento || null,
              })
              .eq("id", victim.id)

            if (victimError) throw victimError

            // Update + insert de recursos de la víctima.
            if (victim.resources && Array.isArray(victim.resources) && victim.resources.length > 0) {
              // 1) Actualizar los que ya estaban en BD por si fueron editados.
              for (const resource of victim.resources.filter(isExistingResource)) {
                const { error: updateError } = await supabase
                  .from("recursos")
                  .update(buildResourceUpdate(resource))
                  .eq("id", resource.id)
                if (updateError) throw updateError
              }

              // 2) Insertar los nuevos (sólo si tienen archivo o URL).
              for (const resource of victim.resources.filter((r: any) => !isExistingResource(r))) {
                if (resource.url || resource.archivo_path) {
                  const { error: resourceError } = await supabase.from("recursos").insert([{
                    victima_id: victim.id,
                    hecho_id: hechoId,
                    ...buildResourceUpdate(resource),
                    archivo_path: resource.archivo_path || null,
                    archivo_nombre: resource.archivo_nombre || null,
                    archivo_tipo: resource.archivo_tipo || null,
                    archivo_size: resource.archivo_size ? Number(resource.archivo_size) : null,
                  }])
                  if (resourceError) throw resourceError
                }
              }
            }
          } else {
            const { data: newVictimData, error: victimInsertError } = await supabase
              .from("victimas")
              .insert([
                {
                  nombre_completo: victim.nombreCompleto || null,
                  fecha_nacimiento: victim.fechaNacimiento || null,
                  edad: victim.edad ? Number.parseInt(victim.edad) : null,
                  profesion: victim.profesion || null,
                  redes_sociales: victim.redesSociales || null,
                  nacionalidad: victim.nacionalidad || null,
                  notas_adicionales: victim.notasAdicionales || null,
                  provincia_residencia: victim.provinciaResidencia || null,
                  municipio_residencia: victim.municipioResidencia || null,
                  fecha_hecho: victim.fechaHecho || null,
                  fecha_fallecimiento: victim.fechaFallecimiento || null,
                },
              ])
              .select()
              .single()

            if (victimInsertError) throw victimInsertError

            // Create caso for new victim
            const { error: casoInsertError } = await supabase.from("casos").insert([
              {
                victima_id: newVictimData.id,
                hecho_id: hechoId,
                estado: formData.incident.estadoCaso || "En investigación",
                estado_general: "En investigación",
              },
            ])
            if (casoInsertError) throw casoInsertError

            // Insert victim resources
            if (victim.resources && Array.isArray(victim.resources) && victim.resources.length > 0) {
              for (const resource of victim.resources) {
                if (resource.titulo || resource.url || resource.archivo_path) {
                  await supabase.from("recursos").insert([
                    {
                      victima_id: newVictimData.id,
                      hecho_id: hechoId,
                      tipo: resource.tipo || null,
                      titulo: resource.titulo || resource.archivo_nombre || "Sin título",
                      url: resource.url || null,
                      fuente: resource.fuente || null,
                      descripcion: resource.descripcion || null,
                      archivo_path: resource.archivo_path || null,
                      archivo_nombre: resource.archivo_nombre || null,
                      archivo_tipo: resource.archivo_tipo || null,
                      archivo_size: resource.archivo_size ? Number(resource.archivo_size) : null,
                    },
                  ])
                }
              }
            }
          }
        }

        const { error: incidentError } = await supabase
          .from("hechos")
          .update({
            provincia: formData.incident.provincia || null,
            municipio: formData.incident.municipio || null,
            localidad_barrio: formData.incident.localidadBarrio || null,
            tipo_lugar: formData.incident.tipoLugar || null,
            lugar_otro: formData.incident.lugarOtro || null,
            resumen_hecho: formData.incident.resumenHecho || null,
            tipo_crimen: formData.incident.tipoCrimen || null,
            tipo_arma: formData.incident.tipoArma || null,
          })
          .eq("id", hechoId!)

        if (incidentError) throw incidentError

        if (hechoId) {
          const { error: estadoError } = await supabase
            .from("casos")
            .update({
              estado: formData.incident.estadoCaso || "En investigación",
            })
            .eq("hecho_id", hechoId)

          if (estadoError) console.error("Error updating case status:", estadoError)
        }

        if (formData.accused && Array.isArray(formData.accused)) {
          // Get current imputados IDs from DB to detect deletions
          const { data: existingImputados } = await supabase.from("imputados").select("id").eq("hecho_id", hechoId!)

          const existingImputadoIds = existingImputados?.map((i) => i.id) || []
          const formImputadoIds = formData.accused
            .filter((a: any) => a.id && typeof a.id === "string" && !a.id.startsWith("temp-"))
            .map((a: any) => a.id)

          // Delete imputados that were removed from the form (diffing)
          const imputadosToDelete = existingImputadoIds.filter((id) => !formImputadoIds.includes(id))
          for (const idToDelete of imputadosToDelete) {
            // First delete related records
            await supabase.from("recursos").delete().eq("imputado_id", idToDelete)
            await supabase.from("instancias_judiciales").delete().eq("imputado_id", idToDelete)
            await supabase.from("fechas_juicio").delete().eq("imputado_id", idToDelete)
            // Then delete the imputado
            await supabase.from("imputados").delete().eq("id", idToDelete)
          }

          // Process each imputado in the form
          for (const accused of formData.accused) {
            if (!accused.apellidoNombre) continue

            const hasExistingId = accused.id && typeof accused.id === "string" && !accused.id.startsWith("temp-")

            let accusedId: string

            if (hasExistingId) {
              const { error: updateError } = await supabase
                .from("imputados")
                .update({
                  apellido_nombre: accused.apellidoNombre,
                  alias: accused.alias || null,
                  edad: accused.edad || null,
                  menor_edad: accused.menorEdad || false,
                  nacionalidad: accused.nacionalidad || null,
                  juzgado_ufi: accused.juzgadoUfi || null,
                  estado_procesal: accused.estadoProcesal || null,
                  pena: accused.pena || null,
                  juicio_abreviado: accused.juicioAbreviado || false,
                  prision_perpetua: accused.prisionPerpetua || false,
                  fecha_veredicto: accused.fechaVeredicto || null,
                  documento_identidad: accused.documentoIdentidad || null,
                  tribunal_fallo: accused.tribunalFallo || null,
                  es_extranjero: accused.esExtranjero || false,
                  detenido_previo: accused.detenidoPrevio || false,
                  fallecido: accused.fallecido || false,
                  es_reincidente: accused.esReincidente || false,
                  cargos: accused.cargos || null,
                })
                .eq("id", accused.id)

              if (updateError) throw updateError
              accusedId = accused.id

              // Save instances_judiciales for each accused
              if (accused.instanciasJudiciales && Array.isArray(accused.instanciasJudiciales)) {
                const { data: existingInstancias } = await supabase
                  .from("instancias_judiciales")
                  .select("id")
                  .eq("imputado_id", accusedId)

                const existingInstanciaIds = (existingInstancias || []).map((i) => i.id)
                const formInstanciaIds = accused.instanciasJudiciales
                  .filter((inst: any) => inst.id && typeof inst.id === "string" && !inst.id.startsWith("temp-"))
                  .map((inst: any) => inst.id)

                // Delete instances removed from form
                const instanciasToDelete = existingInstanciaIds.filter((id) => !formInstanciaIds.includes(id))
                for (const idToDelete of instanciasToDelete) {
                  try {
                    await supabase.from("instancias_judiciales").delete().eq("id", idToDelete)
                  } catch (e) {
                    console.error("[v0] Error deleting instancia:", e)
                  }
                }

                // Update or insert instancias
                for (const instancia of accused.instanciasJudiciales) {
                  const hasInstanciaId =
                    instancia.id && typeof instancia.id === "string" && !instancia.id.startsWith("temp-")

                  try {
                    if (hasInstanciaId) {
                      // Update existing instancia
                      const { error: updateError } = await supabase
                        .from("instancias_judiciales")
                        .update({
                          numero_causa: instancia.numeroCausa || null,
                          fiscal: instancia.fiscalFiscalia || null,
                          fiscalia: instancia.fiscalFiscalia || null,
                          caratula: instancia.caratula || null,
                          orden_nivel: instancia.ordenNivel || null,
                        })
                        .eq("id", instancia.id)

                      if (updateError) {
                        console.error("[v0] Error updating instancia:", updateError)
                        throw updateError
                      }
                    } else {
                      // Insert new instancia
                      const { error: insertError } = await supabase.from("instancias_judiciales").insert([
                        {
                          imputado_id: accusedId,
                          numero_causa: instancia.numeroCausa || null,
                          fiscal: instancia.fiscalFiscalia || null,
                          fiscalia: instancia.fiscalFiscalia || null,
                          caratula: instancia.caratula || null,
                          orden_nivel: instancia.ordenNivel || null,
                        },
                      ])

                      if (insertError) {
                        console.error("[v0] Error inserting instancia:", insertError)
                        throw insertError
                      }
                    }
                  } catch (error) {
                    console.error("[v0] Error in instancia operation:", error)
                    // Continue with other instancias instead of failing completely
                  }
                }
              }

              if (accused.resources && Array.isArray(accused.resources)) {
                // 1) Update de los que ya estaban en BD.
                for (const resource of accused.resources.filter(isExistingResource)) {
                  const { error: updateError } = await supabase
                    .from("recursos")
                    .update(buildResourceUpdate(resource))
                    .eq("id", resource.id)
                  if (updateError) throw updateError
                }

                // 2) Insert de los nuevos (sólo si tienen archivo o URL).
                for (const resource of accused.resources.filter((r: any) => !isExistingResource(r))) {
                  if (resource.url || resource.archivo_path) {
                    await supabase.from("recursos").insert([{
                      imputado_id: accusedId,
                      hecho_id: hechoId,
                      ...buildResourceUpdate(resource),
                      archivo_path: resource.archivo_path || null,
                      archivo_nombre: resource.archivo_nombre || null,
                      archivo_tipo: resource.archivo_tipo || null,
                      archivo_size: resource.archivo_size ? Number(resource.archivo_size) : null,
                    }])
                  }
                }
              }
            } else {
              const { data: accusedData, error: accusedError } = await supabase
                .from("imputados")
                .insert([buildImputadoInsert(accused, hechoId!)])
                .select()
                .single()

              if (accusedError) throw accusedError
              accusedId = accusedData.id

              // Insert all instances for new imputado
              if (accused.instanciasJudiciales && Array.isArray(accused.instanciasJudiciales)) {
                for (const instancia of accused.instanciasJudiciales) {
                  const { error: insertError } = await supabase.from("instancias_judiciales").insert([
                    {
                      imputado_id: accusedId,
                      numero_causa: instancia.numeroCausa || null,
                      fiscal: instancia.fiscalFiscalia || null,
                      fiscalia: instancia.fiscalFiscalia || null,
                      caratula: instancia.caratula || null,
                      orden_nivel: instancia.ordenNivel || null,
                    },
                  ])

                  if (insertError) {
                    console.log("[v0] Error inserting instancia:", insertError)
                  }
                }
              }

              // Insert accused resources
              if (accused.resources && Array.isArray(accused.resources)) {
                for (const resource of accused.resources) {
                  if (resource.url || resource.archivo_path) {
                    await supabase.from("recursos").insert([
                      {
                        imputado_id: accusedId,
                        hecho_id: hechoId,
                        tipo: resource.tipo && resource.tipo !== "" ? resource.tipo : "other",
                        titulo: resource.titulo || resource.archivo_nombre || "Sin título",
                        url: resource.url || null,
                        fuente: resource.fuente || null,
                        descripcion: resource.descripcion || null,
                        archivo_path: resource.archivo_path || null,
                        archivo_nombre: resource.archivo_nombre || null,
                        archivo_tipo: resource.archivo_tipo || null,
                        archivo_size: resource.archivo_size ? Number(resource.archivo_size) : null,
                      },
                    ])
                  }
                }
              }
            }

            await supabase.from("fechas_juicio").delete().eq("imputado_id", accusedId)
            if (accused.trialDates && Array.isArray(accused.trialDates)) {
              for (const date of accused.trialDates) {
                if (date) {
                  await supabase.from("fechas_juicio").insert([
                    {
                      imputado_id: accusedId,
                      fecha_audiencia: date,
                      hecho_id: hechoId,
                    },
                  ])
                }
              }
            }
          }
        }

        const { data: existingSeguimiento } = await supabase
          .from("seguimiento")
          .select("id")
          .eq("hecho_id", hechoId!)
          .single()

        if (formData.followUp) {
          const seguimientoData = {
            hecho_id: hechoId,
            primer_contacto: formData.followUp.primerContacto || null,
            como_llego_caso: formData.followUp.comoLlegoCaso || null,
            miembro_asignado: formData.followUp.miembroAsignado || null,
            contacto_familia: formData.followUp.contactoFamiliar || null,
            telefono_contacto: formData.followUp.telefonoContacto || null,
            tipo_acompanamiento: formData.followUp.tipoAcompanamiento || null,
            abogado_querellante: formData.followUp.abogadoQuerellante || null,
            amicus_curiae: formData.followUp.amicusCuriae || false,
            notas_seguimiento: formData.followUp.notasSeguimiento || null,
            email_contacto: formData.followUp.emailContacto || null,
            direccion_contacto: formData.followUp.direccionContacto || null,
            telefono_miembro: formData.followUp.telefonoMiembro || null,
            email_miembro: formData.followUp.emailMiembro || null,
            fecha_asignacion: formData.followUp.fechaAsignacion || null,
            proximas_acciones: formData.followUp.proximasAcciones || null,
            parentesco_contacto: formData.followUp.parentescoContacto || null,
            parentesco_otro: formData.followUp.parentescoOtro || null,
            tiene_abogado_querellante: formData.followUp.tieneAbogadoQuerellante || "ns_nc",
            abogado_usina_amicus: formData.followUp.abogadoUsinaAmicus || null,
            abogado_amicus_firmante: formData.followUp.abogadoAmicusFirmante || null,
            lista_miembros_asignados: formData.followUp.listaMiembrosAsignados || null,
            lista_contactos_familiares: formData.followUp.listaContactosFamiliares || null,
            datos_abogados_querellantes: formData.followUp.datosAbogadosQuerellantes || null,
            otra_intervencion: formData.followUp.otraIntervencion || false,
            otra_intervencion_descripcion: formData.followUp.otraIntervencionDescripcion || null,
          }

          if (existingSeguimiento?.id) {
            const { error: followUpError } = await supabase
              .from("seguimiento")
              .update(seguimientoData)
              .eq("id", existingSeguimiento.id)
            if (followUpError) throw followUpError
          } else {
            const { error: followUpError } = await supabase.from("seguimiento").insert([seguimientoData])
            if (followUpError) throw followUpError
          }
        }

        if (formData.resources && Array.isArray(formData.resources) && formData.resources.length > 0) {
          // 1) Update de recursos generales del hecho ya existentes.
          for (const resource of formData.resources.filter(isExistingResource)) {
            const { error: updateError } = await supabase
              .from("recursos")
              .update(buildResourceUpdate(resource))
              .eq("id", resource.id)
            if (updateError) throw updateError
          }

          // 2) Insert de los nuevos (sólo si tienen archivo o URL).
          for (const resource of formData.resources.filter((r: any) => !isExistingResource(r))) {
            if (resource.url || resource.archivo_path) {
              const { error: resourceError } = await supabase.from("recursos").insert([{
                hecho_id: hechoId,
                imputado_id: null,
                victima_id: null,
                ...buildResourceUpdate(resource),
                archivo_path: resource.archivo_path || null,
                archivo_nombre: resource.archivo_nombre || null,
                archivo_tipo: resource.archivo_tipo || null,
                archivo_size: resource.archivo_size ? Number(resource.archivo_size) : null,
              }])
              if (resourceError) throw resourceError
            }
          }
        }
      } else {
        // CREATE MODE
        // Step 1: Insert the HECHO (once, use dates from the first victim)
        const firstVictim = formData.victims[0]

        const { data: incidentData, error: incidentError } = await supabase
          .from("hechos")
          .insert([
            {
              victima_id: null,
              fecha_hecho: firstVictim.fechaHecho || null,
              fecha_fallecimiento: firstVictim.fechaFallecimiento || null,
              provincia: formData.incident.provincia || null,
              municipio: formData.incident.municipio || null,
              localidad_barrio: formData.incident.localidadBarrio || null,
              tipo_lugar: formData.incident.tipoLugar || null,
              lugar_otro: formData.incident.lugarOtro || null,
              resumen_hecho: formData.incident.resumenHecho || null,
              tipo_crimen: formData.incident.tipoCrimen || null,
              tipo_arma: formData.incident.tipoArma || null,
              estado_caso: formData.incident.estadoCaso || null,
            },
          ])
          .select()
          .single()

        if (incidentError) throw incidentError
        const hechoId = incidentData.id

        // Step 2: Iterate through VICTIMS array
        for (let i = 0; i < formData.victims.length; i++) {
          const victim = formData.victims[i]

          // Insert victim
          const { data: victimData, error: victimError } = await supabase
            .from("victimas")
            .insert([
              {
                nombre_completo: victim.nombreCompleto || null,
                fecha_nacimiento: victim.fechaNacimiento || null,
                edad: victim.edad ? Number.parseInt(victim.edad) : null,
                profesion: victim.profesion || null,
                redes_sociales: victim.redesSociales || null,
                nacionalidad: victim.nacionalidad || null,
                notas_adicionales: victim.notasAdicionales || null,
                provincia_residencia: victim.provinciaResidencia || null,
                municipio_residencia: victim.municipioResidencia || null,
                fecha_hecho: victim.fechaHecho || null,
                fecha_fallecimiento: victim.fechaFallecimiento || null,
              },
            ])
            .select()
            .single()

          if (victimError) throw victimError

          // Create CASOS record linking victim_id + hecho_id
          const { error: casoInsertError } = await supabase.from("casos").insert([
            {
              victima_id: victimData.id,
              hecho_id: hechoId,
              estado: formData.incident.estadoCaso || "En investigación",
              estado_general: "En investigación",
            },
          ])
          if (casoInsertError) throw casoInsertError

          // Update hecho with the first victim's ID
          if (i === 0) {
            await supabase.from("hechos").update({ victima_id: victimData.id }).eq("id", hechoId)
            firstVictimaId = victimData.id
          }

          // Insert victim resources
          if (victim.resources && Array.isArray(victim.resources) && victim.resources.length > 0) {
            for (const resource of victim.resources) {
              if (resource.titulo || resource.url || resource.archivo_path) {
                await supabase.from("recursos").insert([
                  {
                    victima_id: victimData.id,
                    hecho_id: hechoId,
                    tipo: resource.tipo || null,
                    titulo: resource.titulo || resource.archivo_nombre || "Sin título",
                    url: resource.url || null,
                    fuente: resource.fuente || null,
                    descripcion: resource.descripcion || null,
                    archivo_path: resource.archivo_path || null,
                    archivo_nombre: resource.archivo_nombre || null,
                    archivo_tipo: resource.archivo_tipo || null,
                    archivo_size: resource.archivo_size ? Number(resource.archivo_size) : null,
                  },
                ])
              }
            }
          }
        }

        // Step 3: Iterate through ACCUSED array with their JUDICIAL INSTANCES
        if (formData.accused && Array.isArray(formData.accused) && formData.accused.length > 0) {
          for (const accused of formData.accused) {
            if (accused.apellidoNombre) {
              const { data: accusedData, error: accusedError } = await supabase
                .from("imputados")
                .insert([buildImputadoInsert(accused, hechoId)])
                .select()
                .single()

              if (accusedError) throw accusedError
              const accusedId = accusedData.id

              // Insert trial dates
              if (accused.trialDates && Array.isArray(accused.trialDates)) {
                for (const fecha of accused.trialDates) {
                  if (fecha) {
                    await supabase.from("fechas_juicio").insert([
                      {
                        imputado_id: accusedId,
                        fecha_audiencia: fecha,
                        hecho_id: hechoId,
                      },
                    ])
                  }
                }
              }

              // Insert judicial instances
              if (accused.instanciasJudiciales && Array.isArray(accused.instanciasJudiciales)) {
                for (const instancia of accused.instanciasJudiciales) {
                  const { error: insertError } = await supabase.from("instancias_judiciales").insert([
                    {
                      imputado_id: accusedId,
                      numero_causa: instancia.numeroCausa || null,
                      fiscal: instancia.fiscalFiscalia || null,
                      fiscalia: instancia.fiscalFiscalia || null,
                      caratula: instancia.caratula || null,
                      orden_nivel: instancia.ordenNivel || null,
                    },
                  ])

                  if (insertError) {
                    console.log("[v0] Error inserting instancia:", insertError)
                  }
                }
              }

              // Insert accused resources
              if (accused.resources && Array.isArray(accused.resources)) {
                for (const resource of accused.resources) {
                  if (resource.url || resource.archivo_path) {
                    await supabase.from("recursos").insert([
                      {
                        imputado_id: accusedId,
                        hecho_id: hechoId,
                        tipo: resource.tipo && resource.tipo !== "" ? resource.tipo : "other",
                        titulo: resource.titulo || resource.archivo_nombre || "Sin título",
                        url: resource.url || null,
                        fuente: resource.fuente || null,
                        descripcion: resource.descripcion || null,
                        archivo_path: resource.archivo_path || null,
                        archivo_nombre: resource.archivo_nombre || null,
                        archivo_tipo: resource.archivo_tipo || null,
                        archivo_size: resource.archivo_size ? Number(resource.archivo_size) : null,
                      },
                    ])
                  }
                }
              }
            }
          }
        }

        // Insert seguimiento
        if (formData.followUp) {
          const { error: followUpError } = await supabase.from("seguimiento").insert([
            {
              hecho_id: hechoId,
              primer_contacto: formData.followUp.primerContacto || null,
              como_llego_caso: formData.followUp.comoLlegoCaso || null,
              miembro_asignado: formData.followUp.miembroAsignado || null,
              contacto_familia: formData.followUp.contactoFamiliar || null,
              telefono_contacto: formData.followUp.telefonoContacto || null,
              tipo_acompanamiento: formData.followUp.tipoAcompanamiento || null,
              abogado_querellante: formData.followUp.abogadoQuerellante || null,
              amicus_curiae: formData.followUp.amicusCuriae || false,
              notas_seguimiento: formData.followUp.notasSeguimiento || null,
              email_contacto: formData.followUp.emailContacto || null,
              direccion_contacto: formData.followUp.direccionContacto || null,
              telefono_miembro: formData.followUp.telefonoMiembro || null,
              email_miembro: formData.followUp.emailMiembro || null,
              fecha_asignacion: formData.followUp.fechaAsignacion || null,
              proximas_acciones: formData.followUp.proximasAcciones || null,
              parentesco_contacto: formData.followUp.parentescoContacto || null,
              parentesco_otro: formData.followUp.parentescoOtro || null,
              tiene_abogado_querellante: formData.followUp.tieneAbogadoQuerellante || "ns_nc",
              abogado_usina_amicus: formData.followUp.abogadoUsinaAmicus || null,
              abogado_amicus_firmante: formData.followUp.abogadoAmicusFirmante || null,
              lista_miembros_asignados: formData.followUp.listaMiembrosAsignados || null,
              lista_contactos_familiares: formData.followUp.listaContactosFamiliares || null,
              datos_abogados_querellantes: formData.followUp.datosAbogadosQuerellantes || null,
              otra_intervencion: formData.followUp.otraIntervencion || false,
              otra_intervencion_descripcion: formData.followUp.otraIntervencionDescripcion || null,
            },
          ])
          if (followUpError) throw followUpError
        }

        // Insert general resources for the fact
        if (formData.resources && Array.isArray(formData.resources) && formData.resources.length > 0) {
          for (const resource of formData.resources) {
            if (resource.titulo || resource.url || resource.archivo_path) {
              const resourceData = {
                hecho_id: hechoId,
                tipo: resource.tipo && resource.tipo !== "" ? resource.tipo : "other",
                titulo: resource.titulo || resource.archivo_nombre || "Sin título",
                url: resource.url || null,
                fuente: resource.fuente || null,
                descripcion: resource.descripcion || null,
                archivo_path: resource.archivo_path || null,
                archivo_nombre: resource.archivo_nombre || null,
                archivo_tipo: resource.archivo_tipo || null,
                archivo_size: resource.archivo_size ? Number(resource.archivo_size) : null,
              }
              await supabase.from("recursos").insert([resourceData])
            }
          }
        }
      }

      toast({
        title: mode === "edit" ? "Caso actualizado" : "Caso guardado",
        description:
          mode === "edit"
            ? "Los cambios han sido guardados correctamente."
            : `Se han registrado ${formData.victims.length} víctima(s) correctamente.`,
      })

      // Listados y dashboard quedaron stale tras el insert/update.
      queryClient.invalidateQueries({ queryKey: queryKeys.casesList })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats })

      // Si la ficha vino de una propuesta de Mapa del Delito, cerrar el
      // loop: notificar "aprobada" con el id real de la víctima creada.
      // No bloquea la navegación si falla — /api/candidatos/[id]/decidir
      // ya maneja su propio fallback (pending_callbacks_mdd + cron), y acá
      // sólo puede fallar por un problema de red hacia nuestro propio
      // dominio, algo raro y no bloqueante para el usuario.
      if (fromCandidatoId && firstVictimaId) {
        fetch(`/api/candidatos/${fromCandidatoId}/decidir`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "aprobada", usina_victima_id: firstVictimaId }),
        }).catch((err) => {
          console.error("Error notificando aprobación a Mapa del Delito:", err)
        })
      }

      router.push("/casos")
    } catch (error: any) {
      console.error("Error saving case:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el caso. Verifique la conexión a la base de datos.",
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
