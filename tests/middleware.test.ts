import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
// vi.mock se eleva (hoisting) por encima de este import.
import { updateSession } from "@/lib/supabase/middleware"

const state: { user: { email?: string } | null; allowed: boolean; queries: number } = {
  user: null,
  allowed: false,
  queries: 0,
}

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            state.queries++
            return { data: state.allowed ? { email: state.user?.email } : null, error: null }
          },
        }),
      }),
    }),
  }),
}))


const req = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, "https://app.test"), cookie ? { headers: { cookie } } : undefined)

const location = (res: Response) => {
  const l = res.headers.get("location")
  return l ? new URL(l).pathname : null
}

describe("middleware", () => {
  beforeEach(() => {
    state.user = null
    state.allowed = false
    state.queries = 0
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon"
    process.env.WHITELIST_COOKIE_SECRET = "s"
  })

  it("sin sesión: /login es pública y el resto redirige a /login", async () => {
    expect(location(await updateSession(req("/login")))).toBeNull()
    expect(location(await updateSession(req("/no-autorizado")))).toBeNull()
    expect(location(await updateSession(req("/casos")))).toBe("/login")
    expect(location(await updateSession(req("/api/files/a/b.pdf")))).toBe("/login")
  })

  it("rutas que sólo EMPIEZAN con /login ya no son públicas", async () => {
    expect(location(await updateSession(req("/login-admin")))).toBe("/login")
    expect(location(await updateSession(req("/no-autorizado-x")))).toBe("/login")
  })

  it("logueado fuera de la whitelist -> /no-autorizado", async () => {
    state.user = { email: "random@gmail.com" }
    expect(location(await updateSession(req("/casos")))).toBe("/no-autorizado")
  })

  it("logueado en whitelist pasa y recibe cookie de cache; con cookie no re-consulta", async () => {
    state.user = { email: "staff@usina.org" }
    state.allowed = true
    const res = await updateSession(req("/casos"))
    expect(location(res)).toBeNull()
    expect(state.queries).toBe(1)
    const cookie = res.cookies.get("usina_wl")?.value
    expect(cookie).toBeTruthy()

    const res2 = await updateSession(req("/casos", `usina_wl=${cookie}`))
    expect(location(res2)).toBeNull()
    expect(state.queries).toBe(1)
  })

  it("logueado yendo a /login -> /", async () => {
    state.user = { email: "staff@usina.org" }
    state.allowed = true
    expect(location(await updateSession(req("/login")))).toBe("/")
  })
})
