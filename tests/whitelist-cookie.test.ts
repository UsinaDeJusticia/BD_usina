import { afterEach, describe, expect, it, vi } from "vitest"
import { makeWhitelistCookie, verifyWhitelistCookie } from "@/lib/auth/whitelist-cookie"

const SECRET = "test-secret"

describe("whitelist cookie", () => {
  afterEach(() => vi.useRealTimers())

  it("válida para el mismo email", async () => {
    const c = await makeWhitelistCookie("a@usina.org", SECRET)
    expect(await verifyWhitelistCookie(c, "a@usina.org", SECRET)).toBe(true)
  })

  it("rechaza otro email, otro secret y cookies manipuladas", async () => {
    const c = await makeWhitelistCookie("a@usina.org", SECRET)
    expect(await verifyWhitelistCookie(c, "b@usina.org", SECRET)).toBe(false)
    expect(await verifyWhitelistCookie(c, "a@usina.org", "otro")).toBe(false)
    const [payload, sig] = c.split(".")
    const forged = Buffer.from(`b@usina.org|${Date.now() + 1e9}`).toString("base64url")
    expect(await verifyWhitelistCookie(`${forged}.${sig}`, "b@usina.org", SECRET)).toBe(false)
    expect(await verifyWhitelistCookie(`${payload}.`, "a@usina.org", SECRET)).toBe(false)
    expect(await verifyWhitelistCookie("basura", "a@usina.org", SECRET)).toBe(false)
  })

  it("expira a los 15 minutos", async () => {
    const c = await makeWhitelistCookie("a@usina.org", SECRET)
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 16 * 60 * 1000)
    expect(await verifyWhitelistCookie(c, "a@usina.org", SECRET)).toBe(false)
  })
})
