import { describe, expect, it } from "vitest"
import { isUnsafeExternalUrl, normalizeExternalUrl, safeExternalUrl } from "@/lib/url"

describe("normalizeExternalUrl", () => {
  it("acepta http y https", () => {
    expect(normalizeExternalUrl("https://diario.com/nota?id=1")).toBe("https://diario.com/nota?id=1")
    expect(normalizeExternalUrl("http://diario.com")).toBe("http://diario.com")
    expect(normalizeExternalUrl("  https://a.org  ")).toBe("https://a.org")
  })

  it("antepone https:// cuando falta el esquema (datos viejos tipo www.)", () => {
    expect(normalizeExternalUrl("www.lanacion.com.ar/nota")).toBe("https://www.lanacion.com.ar/nota")
    expect(normalizeExternalUrl("ejemplo.com:8080/x")).toBe("https://ejemplo.com:8080/x")
  })

  it("acepta el proxy interno de archivos", () => {
    expect(normalizeExternalUrl("/api/files/casos/1/a.pdf")).toBe("/api/files/casos/1/a.pdf")
  })

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(document.cookie)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "/otra-ruta-interna",
    "//evil.com/x",
  ])("rechaza %s", (raw) => {
    const out = normalizeExternalUrl(raw)
    // "//evil.com/x" se normaliza a https://evil.com/x (externo pero seguro).
    if (raw === "//evil.com/x") expect(out).toBe("https://evil.com/x")
    else expect(out).toBeNull()
  })

  it("vacío -> null y no se considera inseguro", () => {
    expect(normalizeExternalUrl("")).toBeNull()
    expect(normalizeExternalUrl(null)).toBeNull()
    expect(isUnsafeExternalUrl("")).toBe(false)
    expect(isUnsafeExternalUrl(undefined)).toBe(false)
  })

  it("safeExternalUrl devuelve undefined para valores peligrosos", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeUndefined()
    expect(safeExternalUrl("https://ok.org")).toBe("https://ok.org")
  })
})
