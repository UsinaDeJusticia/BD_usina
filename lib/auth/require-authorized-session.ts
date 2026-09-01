import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient, User } from "@supabase/supabase-js"

export interface AuthorizedSession {
  supabase: SupabaseClient
  user: User
}

/**
 * Chequeo compartido de sesión + whitelist para las API routes internas
 * (`/api/candidatos/*`, `/api/files/*`). Mismo criterio que
 * `lib/supabase/middleware.ts`, pero re-verificado a nivel de route
 * handler: el middleware ya filtró la navegación de páginas, pero un
 * fetch directo a una API route no pasa necesariamente por el mismo chequeo
 * si algún día se llama desde otro contexto (server action, cron, etc).
 */
export async function requireAuthorizedSession(): Promise<
  { ok: true; session: AuthorizedSession } | { ok: false; response: NextResponse }
> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    }
  }

  const { data: allowed, error: allowedError } = await supabase
    .from("allowed_users")
    .select("email")
    .eq("email", user.email)
    .maybeSingle()

  if (allowedError) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Error validando autorización" }, { status: 500 }),
    }
  }
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    }
  }

  return { ok: true, session: { supabase, user } }
}
