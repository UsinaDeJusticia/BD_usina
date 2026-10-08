// Estados procesales tal como los guarda el formulario de casos en
// imputados.estado_procesal (ESTADO_PROCESAL_OPTIONS en
// components/cases/forms/accused-form.tsx). La RPC devuelve esos códigos; este
// módulo los traduce a etiquetas para mostrarlos en el dashboard.

export const ESTADO_PROCESAL = [
  { code: "sospechoso", label: "Sospechoso" },
  { code: "imputado_procesado", label: "Imputado/Procesado" },
  { code: "a_juicio", label: "A juicio" },
  { code: "sobreseido", label: "Sobreseído" },
  { code: "condenado", label: "Condenado" },
  { code: "absuelto", label: "Absuelto" },
  { code: "prescripcion", label: "Prescripción" },
  { code: "menor_inimputable", label: "Menor inimputable" },
] as const

// Valor que la RPC asigna a estado_procesal NULL (coalesce en scripts/011).
export const SIN_ESTADO = "Otros"

/**
 * Devuelve el código canónico de un estado. Acepta el código ("condenado") y
 * también la etiqueta ("Condenado"), que tenían algunos registros anteriores.
 * Un valor desconocido se devuelve tal cual.
 */
export function canonicalEstado(raw: string): string {
  if (raw === SIN_ESTADO) return SIN_ESTADO
  const byCode = ESTADO_PROCESAL.find((estado) => estado.code === raw)
  if (byCode) return byCode.code
  const normalized = raw.trim().toLowerCase()
  const byLabel = ESTADO_PROCESAL.find((estado) => estado.label.toLowerCase() === normalized)
  return byLabel?.code ?? raw
}

export function estadoLabel(canonical: string): string {
  if (canonical === SIN_ESTADO) return "Sin estado"
  return ESTADO_PROCESAL.find((estado) => estado.code === canonical)?.label ?? canonical
}
