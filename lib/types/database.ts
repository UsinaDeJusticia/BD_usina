// Tipos de las filas: salen de lib/types/supabase.ts, que se GENERA desde las
// migraciones (`npm run db:types`). Antes estaban escritos a mano y podían
// desfasarse de la base real.
import type { Tables, TablesInsert, TablesUpdate } from "./supabase"

export type Victima = Tables<"victimas">
export type Hecho = Tables<"hechos">
export type Caso = Tables<"casos">
export type Imputado = Tables<"imputados">
export type FechaJuicio = Tables<"fechas_juicio">
export type Seguimiento = Tables<"seguimiento">
export type Recurso = Tables<"recursos">
export type InstanciaJudicial = Tables<"instancias_judiciales">

export type VictimaInsert = TablesInsert<"victimas">
export type HechoInsert = TablesInsert<"hechos">
export type CasoInsert = TablesInsert<"casos">
export type ImputadoInsert = TablesInsert<"imputados">
export type FechaJuicioInsert = TablesInsert<"fechas_juicio">
export type SeguimientoInsert = TablesInsert<"seguimiento">
export type RecursoInsert = TablesInsert<"recursos">
export type InstanciaJudicialInsert = TablesInsert<"instancias_judiciales">

export type VictimaUpdate = TablesUpdate<"victimas">
export type HechoUpdate = TablesUpdate<"hechos">
export type CasoUpdate = TablesUpdate<"casos">
export type ImputadoUpdate = TablesUpdate<"imputados">
export type FechaJuicioUpdate = TablesUpdate<"fechas_juicio">
export type SeguimientoUpdate = TablesUpdate<"seguimiento">
export type RecursoUpdate = TablesUpdate<"recursos">
export type InstanciaJudicialUpdate = TablesUpdate<"instancias_judiciales">

// Forma del contenido de las columnas jsonb de `seguimiento` (la base sólo
// sabe que son jsonb; esto documenta lo que guarda la app).
export interface MiembroAsignado {
  id: number
  nombre: string
  telefono: string
  email: string
  fecha_asignacion: string
}

export interface ContactoFamiliar {
  id: number
  parentesco: string
  parentesco_otro: string
  nombre: string
  telefono: string
  email: string
  direccion: string
}

export interface AbogadoQuerellante {
  id: number
  nombre: string
  matricula: string
  telefono: string
  email: string
  es_usina: boolean
}
