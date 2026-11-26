import type { TablesInsert } from "@/lib/types/supabase"
// Construcción de filas (snake_case) a partir del estado del formulario de
// casos (camelCase). Antes estos objetos estaban copiados 2-4 veces dentro de
// `components/cases/case-form.tsx` y habían divergido (p.ej. el `tipo` de los
// recursos de víctima podía quedar en null y el insert fallaba en silencio).

import { isUnsafeExternalUrl, normalizeExternalUrl } from "@/lib/url"

 

export function buildVictimRow(victim: any) {
  return {
    // foto_path sólo se escribe si el formulario la conoce: undefined = no
    // tocar (víctima nueva sin foto, o base sin la columna de scripts/017);
    // null = se quitó la foto; string = foto nueva o la misma de antes.
    ...(victim.fotoPath !== undefined ? { foto_path: victim.fotoPath } : {}),
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
  }
}

export function buildIncidentUpdateRow(incident: any) {
  return {
    provincia: incident.provincia || null,
    municipio: incident.municipio || null,
    localidad_barrio: incident.localidadBarrio || null,
    tipo_lugar: incident.tipoLugar || null,
    lugar_otro: incident.lugarOtro || null,
    resumen_hecho: incident.resumenHecho || null,
    tipo_crimen: incident.tipoCrimen || null,
    tipo_arma: incident.tipoArma || null,
  }
}

/** Campos del imputado sin `hecho_id` (para UPDATE). */
export function buildImputadoFields(accused: any) {
  return {
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
  }
}

export function buildImputadoInsert(accused: any, hechoId: string) {
  return { hecho_id: hechoId, ...buildImputadoFields(accused) }
}

export function buildInstanciaFields(instancia: any) {
  return {
    numero_causa: instancia.numeroCausa || null,
    fiscal: instancia.fiscalFiscalia || null,
    fiscalia: instancia.fiscalFiscalia || null,
    caratula: instancia.caratula || null,
    orden_nivel: instancia.ordenNivel || null,
  }
}

export function buildSeguimientoRow(followUp: any, hechoId: string | null) {
  return {
    hecho_id: hechoId,
    primer_contacto: followUp.primerContacto || null,
    como_llego_caso: followUp.comoLlegoCaso || null,
    miembro_asignado: followUp.miembroAsignado || null,
    contacto_familia: followUp.contactoFamiliar || null,
    telefono_contacto: followUp.telefonoContacto || null,
    tipo_acompanamiento: followUp.tipoAcompanamiento || null,
    abogado_querellante: followUp.abogadoQuerellante || null,
    amicus_curiae: followUp.amicusCuriae || false,
    notas_seguimiento: followUp.notasSeguimiento || null,
    email_contacto: followUp.emailContacto || null,
    direccion_contacto: followUp.direccionContacto || null,
    telefono_miembro: followUp.telefonoMiembro || null,
    email_miembro: followUp.emailMiembro || null,
    fecha_asignacion: followUp.fechaAsignacion || null,
    proximas_acciones: followUp.proximasAcciones || null,
    parentesco_contacto: followUp.parentescoContacto || null,
    parentesco_otro: followUp.parentescoOtro || null,
    tiene_abogado_querellante: followUp.tieneAbogadoQuerellante || "ns_nc",
    abogado_usina_amicus: followUp.abogadoUsinaAmicus || null,
    abogado_amicus_firmante: followUp.abogadoAmicusFirmante || null,
    lista_miembros_asignados: followUp.listaMiembrosAsignados || null,
    lista_contactos_familiares: followUp.listaContactosFamiliares || null,
    datos_abogados_querellantes: followUp.datosAbogadosQuerellantes || null,
    otra_intervencion: followUp.otraIntervencion || false,
    otra_intervencion_descripcion: followUp.otraIntervencionDescripcion || null,
  }
}

/**
 * Un recurso es "existente en BD" si su id es un UUID real (36 chars con
 * guiones, no empieza con "temp-"). El resto es un recurso recién agregado.
 */
export function isExistingResource(r: any): boolean {
  return typeof r?.id === "string" && r.id.length === 36 && r.id.includes("-") && !r.id.startsWith("temp-")
}

/** Un recurso nuevo merece guardarse si tiene algo de contenido. */
export function hasResourceContent(r: any): boolean {
  return !!(r?.titulo || r?.url || r?.archivo_path)
}

/**
 * Campos editables de un recurso. Los `archivo_*` no se actualizan acá: si el
 * usuario reemplaza un archivo, el flujo es borrar el recurso viejo y crear
 * uno nuevo. La URL se normaliza (sólo http/https).
 */
export function buildResourceUpdate(resource: any) {
  return {
    tipo: resource.tipo && resource.tipo !== "" ? resource.tipo : "other",
    titulo: resource.titulo || resource.archivo_nombre || "Sin título",
    url: normalizeExternalUrl(resource.url),
    fuente: resource.fuente || null,
    descripcion: resource.descripcion || null,
  }
}

export function buildResourceInsert(
  resource: any,
  owner: { hechoId: string | null; victimaId?: string | null; imputadoId?: string | null },
) {
  const row: TablesInsert<"recursos"> = {
    hecho_id: owner.hechoId,
    ...buildResourceUpdate(resource),
    archivo_path: resource.archivo_path || null,
    archivo_nombre: resource.archivo_nombre || null,
    archivo_tipo: resource.archivo_tipo || null,
    archivo_size: resource.archivo_size ? Number(resource.archivo_size) : null,
  }
  if (owner.victimaId !== undefined) row.victima_id = owner.victimaId
  if (owner.imputadoId !== undefined) row.imputado_id = owner.imputadoId
  return row
}

/**
 * Devuelve la lista de títulos de recursos con URLs inválidas (javascript:,
 * data:, etc.). Se valida ANTES de escribir nada en la BD para no dejar el
 * caso a medio guardar.
 */
// Sólo se validan los recursos NUEVOS. Los ya guardados pueden tener datos
// viejos que no son URLs (p.ej. "pagina de usina de justicia"); bloquear el
// guardado por eso impediría editar el caso. Esos se manejan en save-case:
// no se actualizan (se conservan tal cual) y se avisa al usuario.
export function findUnsafeResourceUrls(formData: any): string[] {
  const all: any[] = [
    ...(formData.resources || []),
    ...(formData.victims || []).flatMap((v: any) => v.resources || []),
    ...(formData.accused || []).flatMap((a: any) => a.resources || []),
  ]
  return all
    .filter((r) => !isExistingResource(r) && !r?.archivo_path && isUnsafeExternalUrl(r?.url))
    .map((r) => r.titulo || r.url || "Sin título")
}
