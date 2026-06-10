"use client"

import type React from "react"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface AuthGuardProps {
  children: React.ReactNode
}

/**
 * Sólo escucha el evento `SIGNED_OUT` para redirigir al login cuando
 * la sesión se cierra en otra pestaña o expira.
 *
 * El chequeo de sesión + whitelist se hace en `lib/supabase/middleware.ts`
 * antes de que la página se sirva al cliente. Por eso este componente
 * ya no monta un spinner bloqueante de "Verificando acceso" en el
 * primer render.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && pathname !== "/login") {
        router.replace("/login")
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [pathname, router])

  return <>{children}</>
}
