import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import {
  WHITELIST_COOKIE_NAME,
  WHITELIST_COOKIE_MAX_AGE_SECONDS,
  makeWhitelistCookie,
  verifyWhitelistCookie,
} from "@/lib/auth/whitelist-cookie"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/no-autorizado"]
  const isPublicRoute = publicRoutes.some((route) => request.nextUrl.pathname.startsWith(route))

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Si ya está logueado y va a /login, mandarlo al home. Antes lo hacía
  // `AuthGuard` en el cliente con un re-check de sesión; ahora se decide
  // en el middleware para evitar el doble fetch y el spinner.
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  if (user && !isPublicRoute) {
    const email = user.email
    if (!email) {
      const url = request.nextUrl.clone()
      url.pathname = "/no-autorizado"
      return NextResponse.redirect(url)
    }

    // Cache hit: cookie firmada con TTL de 15 min. Evita pegarle a
    // `allowed_users` en cada request.
    const secret = process.env.WHITELIST_COOKIE_SECRET
    const cookieValue = request.cookies.get(WHITELIST_COOKIE_NAME)?.value
    let cacheHit = false
    if (secret && cookieValue) {
      cacheHit = await verifyWhitelistCookie(cookieValue, email, secret)
    }

    if (!cacheHit) {
      const { data: allowedUser, error } = await supabase
        .from("allowed_users")
        .select("email")
        .eq("email", email)
        .maybeSingle()

      if (error || !allowedUser) {
        console.log("[v0] User not in whitelist:", email)
        const url = request.nextUrl.clone()
        url.pathname = "/no-autorizado"
        return NextResponse.redirect(url)
      }

      // Refrescar la cookie sólo si hay secret configurado. Sin secret,
      // la mejora queda desactivada pero el flujo sigue funcionando.
      if (secret) {
        const fresh = await makeWhitelistCookie(email, secret)
        supabaseResponse.cookies.set(WHITELIST_COOKIE_NAME, fresh, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: WHITELIST_COOKIE_MAX_AGE_SECONDS,
          path: "/",
        })
      }
    }
  }

  return supabaseResponse
}
