// Acceso a las tablas/RPC de notificaciones (scripts/016_notifications.sql).
// Todas las consultas pasan por RLS: cada usuario sólo ve lo suyo.

import type { SupabaseClient } from "@supabase/supabase-js"

export type TipoNotificacion = "aniversario" | "audiencia" | "caso_nuevo" | "caso_editado" | "prueba"

export interface Notificacion {
  id: string
  tipo: TipoNotificacion
  titulo: string
  cuerpo: string | null
  url: string | null
  leida_at: string | null
  created_at: string
}

export interface PreferenciasNotificacion {
  aniversarios: boolean
  audiencias: boolean
  casos: boolean
}

/** Mismos defaults que crear_notificaciones() cuando no hay fila guardada. */
export const DEFAULT_PREFS: PreferenciasNotificacion = { aniversarios: true, audiencias: true, casos: false }

export const PAGE_SIZE = 30

export async function fetchNotificaciones(supabase: SupabaseClient, limit = PAGE_SIZE): Promise<Notificacion[]> {
  const { data, error } = await supabase
    .from("notificaciones")
    .select("id, tipo, titulo, cuerpo, url, leida_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Notificacion[]
}

/** Cantidad real de no leídas (no depende de cuántas se hayan cargado). */
export async function contarNoLeidas(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("notificaciones")
    .select("id", { count: "exact", head: true })
    .is("leida_at", null)
  if (error) throw error
  return count ?? 0
}

export async function marcarLeida(supabase: SupabaseClient, id: string) {
  const { error } = await supabase
    .from("notificaciones")
    .update({ leida_at: new Date().toISOString() })
    .eq("id", id)
    .is("leida_at", null)
  if (error) throw error
}

export async function marcarTodasLeidas(supabase: SupabaseClient) {
  const { error } = await supabase
    .from("notificaciones")
    .update({ leida_at: new Date().toISOString() })
    .is("leida_at", null)
  if (error) throw error
}

export async function borrarNotificacion(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("notificaciones").delete().eq("id", id)
  if (error) throw error
}

export async function fetchPreferencias(supabase: SupabaseClient): Promise<PreferenciasNotificacion> {
  const { data, error } = await supabase
    .from("notificacion_preferencias")
    .select("aniversarios, audiencias, casos")
    .maybeSingle()
  if (error) throw error
  return data ? (data as PreferenciasNotificacion) : DEFAULT_PREFS
}

export async function guardarPreferencias(
  supabase: SupabaseClient,
  email: string,
  prefs: PreferenciasNotificacion,
) {
  const { error } = await supabase
    .from("notificacion_preferencias")
    .upsert({ user_email: email.toLowerCase(), ...prefs, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function enviarPrueba(supabase: SupabaseClient) {
  const { error } = await supabase.rpc("notificacion_de_prueba")
  if (error) throw error
}

/**
 * Avisa al resto del equipo que se creó o editó un caso. Nunca lanza: una
 * falla acá (p.ej. 016 todavía no aplicado) no debe afectar al guardado.
 */
export async function notificarEventoCaso(
  supabase: SupabaseClient,
  casoId: string | null | undefined,
  tipo: "caso_nuevo" | "caso_editado",
) {
  if (!casoId) return
  try {
    await supabase.rpc("notificar_evento_caso", { p_caso_id: casoId, p_tipo: tipo })
  } catch {
    // ignorado a propósito
  }
}
