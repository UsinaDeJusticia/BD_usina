import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Stubs mínimos del navegador para lib/notifications/push.ts.
function setupBrowser(opts: { subscription: { endpoint: string } | null; permission?: NotificationPermission }) {
  const unsubscribe = vi.fn(async () => true)
  const sub = opts.subscription ? { ...opts.subscription, unsubscribe } : null
  const reg = { pushManager: { getSubscription: async () => sub } }
  const g = globalThis as any
  g.window = { PushManager: class {}, Notification: class {}, matchMedia: () => ({ matches: false }) }
  g.window.PushManager = class {}
  g.Notification = { permission: opts.permission ?? "granted" }
  g.window.Notification = g.Notification
  Object.defineProperty(g, "navigator", {
    configurable: true,
    value: { userAgent: "Chrome", platform: "Linux", maxTouchPoints: 0, serviceWorker: { getRegistration: async () => reg } },
  })
  return { unsubscribe }
}

// Fake de supabase: push_suscripciones devuelve sólo las filas "propias".
function fakeSupabase(ownEndpoints: string[]) {
  const deleted: string[] = []
  return {
    deleted,
    from: (table: string) => {
      expect(table).toBe("push_suscripciones")
      let endpoint = ""
      let op = "select"
      const b: any = {
        select: () => b,
        delete: () => ((op = "delete"), b),
        eq: (_c: string, v: string) => {
          endpoint = v
          if (op === "delete") {
            deleted.push(v)
            return Promise.resolve({ error: null })
          }
          return b
        },
        maybeSingle: async () => ({ data: ownEndpoints.includes(endpoint) ? { id: "x" } : null, error: null }),
      }
      return b
    },
  } as any
}

describe("push en dispositivo compartido", () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U"
  })
  afterEach(() => {
    const g = globalThis as any
    delete g.window
    delete g.Notification
  })

  it("si la suscripción del navegador es de OTRA persona, para el usuario actual está 'off'", async () => {
    setupBrowser({ subscription: { endpoint: "https://push/abc" } })
    const { getPushStatus } = await import("@/lib/notifications/push")
    expect(await getPushStatus(fakeSupabase([]))).toBe("off")
  })

  it("si la suscripción es propia, está 'on'", async () => {
    setupBrowser({ subscription: { endpoint: "https://push/abc" } })
    const { getPushStatus } = await import("@/lib/notifications/push")
    expect(await getPushStatus(fakeSupabase(["https://push/abc"]))).toBe("on")
  })

  it("sin suscripción está 'off'; permiso bloqueado da 'denied'", async () => {
    setupBrowser({ subscription: null })
    let mod = await import("@/lib/notifications/push")
    expect(await mod.getPushStatus(fakeSupabase([]))).toBe("off")
    vi.resetModules()
    setupBrowser({ subscription: { endpoint: "https://push/abc" }, permission: "denied" })
    mod = await import("@/lib/notifications/push")
    expect(await mod.getPushStatus(fakeSupabase(["https://push/abc"]))).toBe("denied")
  })

  it("al cerrar sesión se da de baja la suscripción propia", async () => {
    const { unsubscribe } = setupBrowser({ subscription: { endpoint: "https://push/abc" } })
    const { releasePushOnSignOut } = await import("@/lib/notifications/push")
    const sb = fakeSupabase(["https://push/abc"])
    await releasePushOnSignOut(sb)
    expect(sb.deleted).toEqual(["https://push/abc"])
    expect(unsubscribe).toHaveBeenCalled()
  })

  it("al cerrar sesión NO toca una suscripción ajena", async () => {
    const { unsubscribe } = setupBrowser({ subscription: { endpoint: "https://push/abc" } })
    const { releasePushOnSignOut } = await import("@/lib/notifications/push")
    const sb = fakeSupabase([])
    await releasePushOnSignOut(sb)
    expect(sb.deleted).toEqual([])
    expect(unsubscribe).not.toHaveBeenCalled()
  })
})
