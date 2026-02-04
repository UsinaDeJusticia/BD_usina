"use client"

import type React from "react"

import { useEffect, useState, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"



interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const hasRedirectedRef = useRef(false)
  const supabase = createClient()

useEffect(() => {
    let isMounted = true

    const checkAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (!isMounted) return

        const isAuth = !!session && !error
        setIsAuthenticated(isAuth)

        // Si no está autenticado y no está en login, redirigir a login
        if (!isAuth && pathname !== "/login") {
          hasRedirectedRef.current = true
          router.replace("/login")
          return
        }

        // Si está autenticado y está en login, redirigir a la página principal
        if (isAuth && pathname === "/login") {
          hasRedirectedRef.current = true
          router.replace("/")
          return
        }
      } catch (err) {
        if (isMounted) {
          setIsAuthenticated(false)
          if (pathname !== "/login") {
            hasRedirectedRef.current = true
            router.replace("/login")
          }
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted || hasRedirectedRef.current) return

      const isAuth = !!session
      setIsAuthenticated(isAuth)

      if (event === "SIGNED_OUT" && pathname !== "/login") {
        hasRedirectedRef.current = true
        router.replace("/login")
      }
    })

    checkAuth()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase, pathname, router])

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Verificando acceso...</p>
        </div>
      </div>
    )
  }

  // Si está en la página de login, siempre mostrar
  if (pathname === "/login") {
    return <>{children}</>
  }

  // Si está autenticado, mostrar contenido protegido
  if (isAuthenticated) {
    return <>{children}</>
  }

  // Si no está autenticado, mostrar loading mientras redirige
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-slate-600">Redirigiendo al login...</p>
      </div>
    </div>
  )
}
