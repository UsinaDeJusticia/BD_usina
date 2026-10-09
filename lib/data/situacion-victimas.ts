// Situación procesal de cada víctima. La RPC la calcula (scripts/012): el estado
// más avanzado entre los imputados de sus hechos, en este orden de prioridad.
// "sin_condena" agrupa absueltos, sobreseídos, prescriptos y menores inimputables.

export const SITUACION_VICTIMA = [
  { code: "condenado", label: "Con condena" },
  { code: "a_juicio", label: "A juicio" },
  { code: "imputado_procesado", label: "Imputado/procesado" },
  { code: "sospechoso", label: "Sospechoso" },
  { code: "sin_condena", label: "Sin condena" },
  { code: "sin_estado", label: "Sin estado registrado" },
  { code: "sin_imputado", label: "Sin imputado identificado" },
] as const

export function situacionLabel(code: string): string {
  return SITUACION_VICTIMA.find((situacion) => situacion.code === code)?.label ?? code
}
