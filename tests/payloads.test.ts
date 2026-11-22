import { describe, expect, it } from "vitest"
import {
  buildResourceInsert,
  buildResourceUpdate,
  buildSeguimientoRow,
  buildVictimRow,
  findUnsafeResourceUrls,
  hasResourceContent,
  isExistingResource,
} from "@/lib/cases/payloads"

describe("payloads de casos", () => {
  it("buildVictimRow mapea camelCase -> snake_case y vacíos a null", () => {
    const row = buildVictimRow({ nombreCompleto: "Ana", edad: "34", fechaNacimiento: "", provinciaResidencia: "Salta" })
    expect(row).toMatchObject({ nombre_completo: "Ana", edad: 34, fecha_nacimiento: null, provincia_residencia: "Salta" })
  })

  it("los recursos siempre tienen tipo (antes podía quedar null y el insert fallaba en silencio)", () => {
    expect(buildResourceUpdate({ tipo: "" }).tipo).toBe("other")
    expect(buildResourceUpdate({ tipo: null }).tipo).toBe("other")
    expect(buildResourceUpdate({ tipo: "Foto" }).tipo).toBe("Foto")
  })

  it("normaliza la URL del recurso y conserva archivos subidos", () => {
    expect(buildResourceUpdate({ url: "www.diario.com/n" }).url).toBe("https://www.diario.com/n")
    const ins = buildResourceInsert(
      { url: "/api/files/casos/x.pdf", archivo_path: "casos/x.pdf", archivo_size: "123", archivo_nombre: "x.pdf" },
      { hechoId: "h1", victimaId: "v1" },
    )
    expect(ins).toMatchObject({
      hecho_id: "h1",
      victima_id: "v1",
      url: "/api/files/casos/x.pdf",
      archivo_path: "casos/x.pdf",
      archivo_size: 123,
      titulo: "x.pdf",
    })
    expect(ins).not.toHaveProperty("imputado_id")
  })

  it("recursos generales del hecho llevan victima/imputado en null explícito", () => {
    const ins = buildResourceInsert({ titulo: "t" }, { hechoId: "h", victimaId: null, imputadoId: null })
    expect(ins.victima_id).toBeNull()
    expect(ins.imputado_id).toBeNull()
  })

  it("detecta URLs peligrosas en víctimas, imputados y recursos generales", () => {
    const bad = findUnsafeResourceUrls({
      resources: [{ titulo: "ok", url: "https://a.org" }],
      victims: [{ resources: [{ titulo: "malo", url: "javascript:alert(1)" }] }],
      accused: [{ resources: [{ url: "data:text/html,x" }, { archivo_path: "a/b.pdf", url: "/api/files/a/b.pdf" }] }],
    })
    expect(bad).toEqual(["malo", "data:text/html,x"])
  })

  it("no bloquea por recursos YA guardados con enlaces viejos inválidos", () => {
    const bad = findUnsafeResourceUrls({
      victims: [{ resources: [{ id: "4b6c3a8e-1d2f-4a5b-9c8d-7e6f5a4b3c2d", titulo: "x", url: "pagina de usina de justicia " }] }],
    })
    expect(bad).toEqual([])
  })

  it("isExistingResource / hasResourceContent", () => {
    expect(isExistingResource({ id: "4b6c3a8e-1d2f-4a5b-9c8d-7e6f5a4b3c2d" })).toBe(true)
    expect(isExistingResource({ id: "temp-123" })).toBe(false)
    expect(isExistingResource({ id: 17 })).toBe(false)
    expect(hasResourceContent({ titulo: "", url: "" })).toBe(false)
    expect(hasResourceContent({ titulo: "Sólo título" })).toBe(true)
  })

  it("buildSeguimientoRow conserva defaults", () => {
    const row = buildSeguimientoRow({}, "h1")
    expect(row.hecho_id).toBe("h1")
    expect(row.tiene_abogado_querellante).toBe("ns_nc")
    expect(row.amicus_curiae).toBe(false)
  })
})
