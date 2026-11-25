import { describe, expect, it } from "vitest"
import { colorFor, computeCrop, initials, isProfilePhotoPath } from "@/lib/photos/utils"
import { buildVictimRow } from "@/lib/cases/payloads"

describe("initials", () => {
  it.each([
    ["Martín Gómez", "MG"],
    ["María José Pérez", "MP"],
    ["  ana  ", "A"],
    ["Ñandú Óscar", "ÑÓ"],
    ["", "?"],
    [null, "?"],
    ["- -", "?"],
  ])("%s → %s", (name, out) => {
    expect(initials(name as string | null)).toBe(out)
  })
})

describe("colorFor", () => {
  it("es estable para el mismo nombre (sin importar mayúsculas/espacios)", () => {
    expect(colorFor("Lucía Fernández")).toEqual(colorFor("  lucía fernández "))
  })
  it("reparte tonos distintos", () => {
    const names = ["Ana", "Beto", "Carla", "Dario", "Elena", "Fede", "Gabi", "Hugo", "Inés", "Juan"]
    expect(new Set(names.map((n) => colorFor(n).bg)).size).toBeGreaterThan(3)
  })
})

describe("computeCrop", () => {
  it("zoom 1 centrado: recorta el cuadrado central de la imagen", () => {
    const c = computeCrop(1200, 800, 300, { zoom: 1, offsetX: 0, offsetY: 0 })
    expect(c.size).toBeCloseTo(800)
    expect(c.sx).toBeCloseTo(200)
    expect(c.sy).toBeCloseTo(0)
  })
  it("zoom 2 achica el recorte a la mitad, centrado", () => {
    const c = computeCrop(1000, 1000, 300, { zoom: 2, offsetX: 0, offsetY: 0 })
    expect(c.size).toBeCloseTo(500)
    expect(c.sx).toBeCloseTo(250)
    expect(c.sy).toBeCloseTo(250)
  })
  it("no deja bordes vacíos: el desplazamiento se limita", () => {
    const c = computeCrop(1200, 800, 300, { zoom: 1, offsetX: 10_000, offsetY: -10_000 })
    expect(c.sx).toBeCloseTo(0) // pegado al borde izquierdo
    expect(c.sy).toBeCloseTo(0) // en vertical no hay margen a zoom 1
    expect(c.sx + c.size).toBeLessThanOrEqual(1200)
  })
  it("zoom menor a 1 se trata como 1", () => {
    expect(computeCrop(500, 500, 300, { zoom: 0.2, offsetX: 0, offsetY: 0 }).size).toBeCloseTo(500)
  })
})

describe("isProfilePhotoPath", () => {
  it("sólo acepta rutas bajo fotos-perfil/ sin ..", () => {
    expect(isProfilePhotoPath("fotos-perfil/abc.jpg")).toBe(true)
    expect(isProfilePhotoPath("casos/x/foto.jpg")).toBe(false)
    expect(isProfilePhotoPath("fotos-perfil/../casos/x.pdf")).toBe(false)
    expect(isProfilePhotoPath(null)).toBe(false)
  })
})

describe("buildVictimRow y foto_path (no perder datos)", () => {
  it("undefined → no toca la columna", () => {
    expect(buildVictimRow({ nombreCompleto: "A" })).not.toHaveProperty("foto_path")
  })
  it("null → quita la foto; string → la guarda", () => {
    expect(buildVictimRow({ fotoPath: null }).foto_path).toBeNull()
    expect(buildVictimRow({ fotoPath: "fotos-perfil/x.jpg" }).foto_path).toBe("fotos-perfil/x.jpg")
  })
})

describe("classifyPhotoSupport (Codex #40)", () => {
  it("sin error → la columna existe", async () => {
    const { classifyPhotoSupport } = await import("@/lib/photos/use-photo-support")
    expect(classifyPhotoSupport(null)).toBe(true)
  })
  it("columna inexistente → false (017 sin aplicar)", async () => {
    const { classifyPhotoSupport } = await import("@/lib/photos/use-photo-support")
    expect(classifyPhotoSupport({ code: "42703", message: "column victimas.foto_path does not exist" })).toBe(false)
    expect(classifyPhotoSupport({ code: "PGRST204", message: "Could not find the 'foto_path' column" })).toBe(false)
  })
  it("errores pasajeros se relanzan para reintentar (no ocultan el selector)", async () => {
    const { classifyPhotoSupport } = await import("@/lib/photos/use-photo-support")
    expect(() => classifyPhotoSupport({ code: "", message: "TypeError: Failed to fetch" })).toThrow()
    expect(() => classifyPhotoSupport({ code: "PGRST002", message: "Could not query the database for the schema cache" })).toThrow()
    expect(() => classifyPhotoSupport({ code: "503", message: "Service Unavailable" })).toThrow()
  })
})
