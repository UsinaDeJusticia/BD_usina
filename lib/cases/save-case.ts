// Guardado de un caso (crear / editar) contra Supabase.
//
// Extraído de `components/cases/case-form.tsx` para poder testearlo
// (tests/save-case.test.ts) y achicar el componente. La lógica de negocio es
// la misma que antes, con estas garantías nuevas:
//   - Todo error de escritura se detecta (antes varios inserts de recursos,
//     fechas e instancias eran "fire and forget" y se perdían en silencio).
//   - Errores no fatales (instancias judiciales, estado del caso) se devuelven
//     en `warnings` para mostrarlos al usuario en vez de tragarlos.
//   - Modo create: si algo falla a mitad, se deshacen SÓLO las filas creadas
//     en este intento (el formulario conserva los datos para reintentar).
//   - Fechas de juicio: si el reemplazo falla, se restauran las anteriores.
//   - Recursos a eliminar: primero las filas, después los archivos.

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildImputadoFields,
  buildImputadoInsert,
  buildIncidentUpdateRow,
  buildInstanciaFields,
  buildResourceInsert,
  buildResourceUpdate,
  buildSeguimientoRow,
  buildVictimRow,
  hasResourceContent,
  isExistingResource,
} from "@/lib/cases/payloads"

export interface SaveCaseInput {
  supabase: SupabaseClient
  mode: "create" | "edit"
  caseId?: string
  formData: any
  realIds: { victimaId: string | null; hechoId: string | null; casoId: string | null }
  resourcesToDelete: string[]
}

export interface SaveCaseResult {
  warnings: string[]
}

export async function saveCase({
  supabase,
  mode,
  caseId,
  formData,
  realIds,
  resourcesToDelete,
}: SaveCaseInput): Promise<SaveCaseResult> {
  // Errores no fatales (p.ej. una instancia judicial que no se pudo
  // guardar). Antes se tragaban con console.error y el usuario veía
  // "guardado correctamente"; ahora se informan en el toast final.
  const warnings: string[] = []

  // Inserta y lanza si falla. Evita los inserts "fire and forget" que
  // perdían recursos en silencio.
  const insertOrThrow = async (table: string, row: Record<string, unknown>) => {
    const { error } = await supabase.from(table).insert([row])
    if (error) throw error
  }

  // Reemplaza las fechas de juicio de un imputado sin perder las
  // existentes si el insert falla (antes: delete + insert sin chequeo).
  const replaceTrialDates = async (accusedId: string, hechoId: string | null, dates: any[]) => {
    const { data: previous } = await supabase
      .from("fechas_juicio")
      .select("fecha_audiencia, descripcion")
      .eq("imputado_id", accusedId)
    const newRows = (dates || [])
      .filter(Boolean)
      .map((date: string) => ({ imputado_id: accusedId, fecha_audiencia: date, hecho_id: hechoId }))

    const { error: delError } = await supabase.from("fechas_juicio").delete().eq("imputado_id", accusedId)
    if (delError) throw delError
    if (newRows.length === 0) return

    const { error: insError } = await supabase.from("fechas_juicio").insert(newRows)
    if (insError) {
      // Restaurar las fechas previas para no perder datos.
      if (previous && previous.length > 0) {
        await supabase.from("fechas_juicio").insert(
          previous.map((p: any) => ({ ...p, imputado_id: accusedId, hecho_id: hechoId })),
        )
      }
      throw insError
    }
  }

  const saveInstancia = async (instancia: any, accusedId: string) => {
    const hasInstanciaId = instancia.id && typeof instancia.id === "string" && !instancia.id.startsWith("temp-")
    const { error } = hasInstanciaId
      ? await supabase.from("instancias_judiciales").update(buildInstanciaFields(instancia)).eq("id", instancia.id)
      : await supabase
          .from("instancias_judiciales")
          .insert([{ imputado_id: accusedId, ...buildInstanciaFields(instancia) }])
    if (error) {
      warnings.push(`instancia judicial "${instancia.numeroCausa || instancia.caratula || "sin datos"}"`)
    }
  }

  const saveResources = async (
    resources: any[] | undefined,
    owner: { hechoId: string | null; victimaId?: string | null; imputadoId?: string | null },
  ) => {
    if (!Array.isArray(resources)) return
    // 1) Update de los que ya estaban en BD por si fueron editados.
    for (const resource of resources.filter(isExistingResource)) {
      const { error } = await supabase.from("recursos").update(buildResourceUpdate(resource)).eq("id", resource.id)
      if (error) throw error
    }
    // 2) Insert de los nuevos con contenido.
    for (const resource of resources.filter((r: any) => !isExistingResource(r) && hasResourceContent(r))) {
      await insertOrThrow("recursos", buildResourceInsert(resource, owner))
    }
  }

  // Filas creadas en modo "create", para deshacer si algo falla a mitad.
  const created = { hechoId: null as string | null, victimaIds: [] as string[] }

  try {
    if (mode === "edit" && caseId) {
      const hechoId = realIds.hechoId

      if (resourcesToDelete.length > 0) {
        const { data: resourcesToRemove } = await supabase
          .from("recursos")
          .select("archivo_path")
          .in("id", resourcesToDelete)

        // Primero borrar las filas; recién después los archivos. Si el
        // delete de filas falla, los archivos siguen intactos.
        const { error: deleteError } = await supabase.from("recursos").delete().in("id", resourcesToDelete)
        if (deleteError) throw deleteError

        const pathsToDelete = (resourcesToRemove || []).map((r) => r.archivo_path).filter((p): p is string => !!p)
        if (pathsToDelete.length > 0) {
          const { error: storageError } = await supabase.storage.from("archivos-casos").remove(pathsToDelete)
          if (storageError) warnings.push("algunos archivos adjuntos eliminados no se borraron del almacenamiento")
        }
      }

      for (const victim of formData.victims) {
        if (victim.id) {
          const { error: victimError } = await supabase
            .from("victimas")
            .update(buildVictimRow(victim))
            .eq("id", victim.id)
          if (victimError) throw victimError

          await saveResources(victim.resources, { hechoId, victimaId: victim.id })
        } else {
          const { data: newVictimData, error: victimInsertError } = await supabase
            .from("victimas")
            .insert([buildVictimRow(victim)])
            .select()
            .single()
          if (victimInsertError) throw victimInsertError

          await insertOrThrow("casos", {
            victima_id: newVictimData.id,
            hecho_id: hechoId,
            estado: formData.incident.estadoCaso || "En investigación",
            estado_general: "En investigación",
          })

          await saveResources(victim.resources, { hechoId, victimaId: newVictimData.id })
        }
      }

      // Fichas viejas sin hecho: los datos de víctimas ya se guardaron
      // arriba; el resto depende del hecho.
      if (!hechoId) throw new Error("Se guardaron los datos de la víctima, pero el caso no tiene un hecho asociado.")

      const { error: incidentError } = await supabase
        .from("hechos")
        .update(buildIncidentUpdateRow(formData.incident))
        .eq("id", hechoId)
      if (incidentError) throw incidentError

      const { error: estadoError } = await supabase
        .from("casos")
        .update({ estado: formData.incident.estadoCaso || "En investigación" })
        .eq("hecho_id", hechoId)
      if (estadoError) warnings.push("estado del caso")

      if (Array.isArray(formData.accused)) {
        // Detectar imputados quitados del form (diffing).
        const { data: existingImputados, error: existingError } = await supabase
          .from("imputados")
          .select("id")
          .eq("hecho_id", hechoId)
        if (existingError) throw existingError

        const existingImputadoIds = existingImputados?.map((i) => i.id) || []
        const formImputadoIds = formData.accused
          .filter((a: any) => a.id && typeof a.id === "string" && !a.id.startsWith("temp-"))
          .map((a: any) => a.id)

        const imputadosToDelete = existingImputadoIds.filter((id) => !formImputadoIds.includes(id))
        for (const idToDelete of imputadosToDelete) {
          // Primero los registros relacionados, después el imputado.
          for (const table of ["recursos", "instancias_judiciales", "fechas_juicio"]) {
            const { error } = await supabase.from(table).delete().eq("imputado_id", idToDelete)
            if (error) throw error
          }
          const { error } = await supabase.from("imputados").delete().eq("id", idToDelete)
          if (error) throw error
        }

        for (const accused of formData.accused) {
          if (!accused.apellidoNombre) continue

          const hasExistingId = accused.id && typeof accused.id === "string" && !accused.id.startsWith("temp-")
          let accusedId: string

          if (hasExistingId) {
            const { error: updateError } = await supabase
              .from("imputados")
              .update(buildImputadoFields(accused))
              .eq("id", accused.id)
            if (updateError) throw updateError
            accusedId = accused.id

            if (Array.isArray(accused.instanciasJudiciales)) {
              const { data: existingInstancias } = await supabase
                .from("instancias_judiciales")
                .select("id")
                .eq("imputado_id", accusedId)

              const existingInstanciaIds = (existingInstancias || []).map((i) => i.id)
              const formInstanciaIds = accused.instanciasJudiciales
                .filter((inst: any) => inst.id && typeof inst.id === "string" && !inst.id.startsWith("temp-"))
                .map((inst: any) => inst.id)

              const instanciasToDelete = existingInstanciaIds.filter((id) => !formInstanciaIds.includes(id))
              for (const idToDelete of instanciasToDelete) {
                const { error } = await supabase.from("instancias_judiciales").delete().eq("id", idToDelete)
                if (error) warnings.push("eliminar una instancia judicial")
              }

              for (const instancia of accused.instanciasJudiciales) {
                await saveInstancia(instancia, accusedId)
              }
            }
          } else {
            const { data: accusedData, error: accusedError } = await supabase
              .from("imputados")
              .insert([buildImputadoInsert(accused, hechoId)])
              .select()
              .single()
            if (accusedError) throw accusedError
            accusedId = accusedData.id

            for (const instancia of accused.instanciasJudiciales || []) {
              await saveInstancia({ ...instancia, id: null }, accusedId)
            }
          }

          await saveResources(accused.resources, { hechoId, imputadoId: accusedId })
          await replaceTrialDates(accusedId, hechoId, accused.trialDates)
        }
      }

      if (formData.followUp) {
        const { data: existingSeguimiento } = await supabase
          .from("seguimiento")
          .select("id")
          .eq("hecho_id", hechoId)
          .order("created_at", { ascending: true })
          .limit(1)
        const seguimientoId = existingSeguimiento?.[0]?.id
        const seguimientoData = buildSeguimientoRow(formData.followUp, hechoId)

        const { error: followUpError } = seguimientoId
          ? await supabase.from("seguimiento").update(seguimientoData).eq("id", seguimientoId)
          : await supabase.from("seguimiento").insert([seguimientoData])
        if (followUpError) throw followUpError
      }

      await saveResources(formData.resources, { hechoId, imputadoId: null, victimaId: null })
    } else {
      // CREATE MODE
      // Step 1: HECHO (una sola vez, con las fechas de la primera víctima)
      const firstVictim = formData.victims[0]

      const { data: incidentData, error: incidentError } = await supabase
        .from("hechos")
        .insert([
          {
            victima_id: null,
            fecha_hecho: firstVictim.fechaHecho || null,
            fecha_fallecimiento: firstVictim.fechaFallecimiento || null,
            ...buildIncidentUpdateRow(formData.incident),
            estado_caso: formData.incident.estadoCaso || null,
          },
        ])
        .select()
        .single()

      if (incidentError) throw incidentError
      const hechoId: string = incidentData.id
      created.hechoId = hechoId

      // Step 2: VÍCTIMAS + CASOS
      for (let i = 0; i < formData.victims.length; i++) {
        const victim = formData.victims[i]

        const { data: victimData, error: victimError } = await supabase
          .from("victimas")
          .insert([buildVictimRow(victim)])
          .select()
          .single()
        if (victimError) throw victimError
        created.victimaIds.push(victimData.id)

        await insertOrThrow("casos", {
          victima_id: victimData.id,
          hecho_id: hechoId,
          estado: formData.incident.estadoCaso || "En investigación",
          estado_general: "En investigación",
        })

        if (i === 0) {
          const { error } = await supabase.from("hechos").update({ victima_id: victimData.id }).eq("id", hechoId)
          if (error) throw error
        }

        await saveResources(victim.resources, { hechoId, victimaId: victimData.id })
      }

      // Step 3: IMPUTADOS con instancias, fechas y recursos
      for (const accused of formData.accused || []) {
        if (!accused.apellidoNombre) continue
        const { data: accusedData, error: accusedError } = await supabase
          .from("imputados")
          .insert([buildImputadoInsert(accused, hechoId)])
          .select()
          .single()
        if (accusedError) throw accusedError
        const accusedId = accusedData.id

        await replaceTrialDates(accusedId, hechoId, accused.trialDates)
        for (const instancia of accused.instanciasJudiciales || []) {
          await saveInstancia({ ...instancia, id: null }, accusedId)
        }
        await saveResources(accused.resources, { hechoId, imputadoId: accusedId })
      }

      // Step 4: SEGUIMIENTO
      if (formData.followUp) {
        await insertOrThrow("seguimiento", buildSeguimientoRow(formData.followUp, hechoId))
      }

      // Step 5: Recursos generales del hecho
      await saveResources(formData.resources, { hechoId })
    }
  } catch (error) {
  // Modo create: deshacer las filas creadas en ESTE intento para no
  // dejar un caso a medio guardar (ni duplicados al reintentar). Los
  // datos siguen en el formulario, así que el usuario puede reintentar.
  // Sólo se tocan filas recién creadas; nunca datos preexistentes.
  if (mode === "create" && (created.hechoId || created.victimaIds.length > 0)) {
    try {
      if (created.hechoId) {
        const { data: imps } = await supabase.from("imputados").select("id").eq("hecho_id", created.hechoId)
        const impIds = (imps || []).map((i: any) => i.id)
        if (impIds.length > 0) {
          await supabase.from("instancias_judiciales").delete().in("imputado_id", impIds)
          await supabase.from("fechas_juicio").delete().in("imputado_id", impIds)
        }
        await supabase.from("recursos").delete().eq("hecho_id", created.hechoId)
        await supabase.from("seguimiento").delete().eq("hecho_id", created.hechoId)
        await supabase.from("imputados").delete().eq("hecho_id", created.hechoId)
        await supabase.from("casos").delete().eq("hecho_id", created.hechoId)
      }
      if (created.victimaIds.length > 0) {
        await supabase.from("recursos").delete().in("victima_id", created.victimaIds)
        await supabase.from("casos").delete().in("victima_id", created.victimaIds)
      }
      if (created.hechoId) {
        await supabase.from("hechos").delete().eq("id", created.hechoId)
      }
      if (created.victimaIds.length > 0) {
        await supabase.from("victimas").delete().in("id", created.victimaIds)
      }
    } catch {
      // Si el rollback falla, el caso parcial queda visible y editable.
    }
  }
    throw error
  }

  return { warnings }
}
