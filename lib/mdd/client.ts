import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Cliente hacia el proyecto Supabase de Mapa del Delito (MdD). Server-only:
// usa un JWT de servicio (`rol_usina_revisor`, ver
// scripts/mapa-del-delito/003_rol_usina_revisor.sql) que NUNCA debe llegar
// al navegador. El guard de abajo lo hace explícito en runtime — si algún
// día este módulo se importa por error desde un componente cliente, falla
// ruidosamente en vez de filtrar la credencial en el bundle.
if (typeof window !== "undefined") {
  throw new Error("lib/mdd/client.ts es server-only: no debe importarse desde código de cliente")
}

let cached: SupabaseClient | null = null

/**
 * Cliente Supabase apuntando a Mapa del Delito, autenticado como
 * `rol_usina_revisor`. Sólo puede:
 *   - SELECT sobre `api_propuestas_publicas` (propuestas pendientes).
 *   - UPDATE de columnas de decisión sobre `propuestas_para_usina`.
 * Nada más — los permisos reales los impone el rol Postgres del otro lado,
 * no este cliente.
 */
export function getMddClient(): SupabaseClient {
  if (cached) return cached

  const url = process.env.MDD_SUPABASE_URL
  const jwt = process.env.MDD_SUPABASE_JWT

  if (!url || !jwt) {
    throw new Error(
      "Faltan MDD_SUPABASE_URL / MDD_SUPABASE_JWT en las env vars del servidor. " +
        "Ver docs/integracion-mapa-del-delito.md.",
    )
  }

  cached = createClient(url, jwt, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return cached
}
