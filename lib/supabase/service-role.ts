import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Cliente con SUPABASE_SERVICE_ROLE_KEY: ignora RLS por completo. Server-only
// y de uso MUY acotado — sólo para el cron de reintentos
// (`app/api/cron/retry-mdd-callbacks`), que corre sin sesión de usuario
// (Vercel Cron no tiene cookie de auth) y necesita leer/escribir
// `pending_callbacks_mdd` sin depender de `is_allowed_user()`.
//
// NO usar este cliente en ninguna route que sirva al navegador o que
// pueda ser invocada por un usuario común — eso reintroduciría el mismo
// problema que Fase 0 (scripts/014_harden_rls.sql) cerró.
if (typeof window !== "undefined") {
  throw new Error("lib/supabase/service-role.ts es server-only: no debe importarse desde código de cliente")
}

let cached: SupabaseClient | null = null

export function getServiceRoleClient(): SupabaseClient {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en las env vars del servidor.")
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return cached
}
