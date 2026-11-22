// Tests de integración de saveCase contra Postgres real.
// Requieren TEST_DATABASE_URL (p.ej. postgres://postgres@localhost:5432/postgres).
// Sin esa variable se saltean (CI los corre con un servicio Postgres).
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { Client } from "pg"
import { saveCase } from "@/lib/cases/save-case"
import { createPgSupabase } from "./helpers/pg-supabase"

const ADMIN_URL = process.env.TEST_DATABASE_URL
const DB_NAME = `usina_test_${process.pid}`
const run = ADMIN_URL ? describe : describe.skip

let admin: Client
let db: Client
let fake: ReturnType<typeof createPgSupabase>

const uuid = () => crypto.randomUUID()
const count = async (table: string) => Number((await db.query(`select count(*) from public.${table}`)).rows[0].count)

const victim = (over: Record<string, unknown> = {}) => ({
  id: null,
  casoId: null,
  nombreCompleto: "Víctima",
  fechaNacimiento: "1990-03-04",
  edad: "33",
  profesion: "",
  redesSociales: "",
  nacionalidad: "Argentina",
  notasAdicionales: "",
  provinciaResidencia: "",
  municipioResidencia: "",
  fechaHecho: "2023-01-02",
  fechaFallecimiento: "2023-01-03",
  resources: [] as any[],
  ...over,
})

const fullForm = () => ({
  victims: [
    victim({
      nombreCompleto: "Ana Pérez",
      // tipo vacío: antes quedaba null y el insert fallaba EN SILENCIO.
      resources: [{ id: "temp-1", tipo: "", titulo: "Foto de Ana", url: "www.diario.com/ana" }],
    }),
    victim({ nombreCompleto: "Luis Gómez" }),
  ],
  incident: { provincia: "Buenos Aires", municipio: "La Plata", resumenHecho: "Robo", estadoCaso: "En investigación" },
  accused: [
    {
      id: "temp-a",
      apellidoNombre: "Imputado Uno",
      estadoProcesal: "Detenido",
      trialDates: ["2024-05-01", "2024-06-01"],
      instanciasJudiciales: [
        { id: "temp-i1", numeroCausa: "C-1", fiscalFiscalia: "UFI 1", caratula: "X", ordenNivel: "1" },
        { id: "temp-i2", numeroCausa: "C-2", fiscalFiscalia: "", caratula: "", ordenNivel: "2" },
      ],
      resources: [{ id: "temp-r", tipo: "Nota", titulo: "Nota imp", url: "https://a.org/n" }],
    },
  ],
  followUp: {
    notasSeguimiento: "seguimiento inicial",
    tipoAcompanamiento: ["legal", "psicologico"],
    listaMiembrosAsignados: [{ id: 1, nombre: "M", telefono: "", email: "", fecha_asignacion: "" }],
    otraIntervencion: false,
  },
  resources: [
    { id: "temp-g", tipo: "", titulo: "Resolución", url: "/api/files/casos/r.pdf", archivo_path: "casos/r.pdf", archivo_size: 10 },
  ],
})

const create = (formData: any) =>
  saveCase({
    supabase: fake.client,
    mode: "create",
    formData,
    realIds: { victimaId: null, hechoId: null, casoId: null },
    resourcesToDelete: [],
  })

run("saveCase (Postgres real)", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL })
    await admin.connect()
    await admin.query(`drop database if exists ${DB_NAME}`)
    await admin.query(`create database ${DB_NAME}`)
    const url = new URL(ADMIN_URL!)
    url.pathname = `/${DB_NAME}`
    db = new Client({ connectionString: url.toString() })
    await db.connect()
    await db.query(readFileSync(new URL("./fixtures/schema.sql", import.meta.url), "utf8"))
  })

  afterAll(async () => {
    await db?.end()
    if (admin) {
      await admin.query(`drop database if exists ${DB_NAME}`)
      await admin.end()
    }
  })

  beforeEach(async () => {
    await db.query(
      "truncate public.recursos, public.fechas_juicio, public.instancias_judiciales, public.seguimiento, public.imputados, public.casos, public.hechos, public.victimas cascade",
    )
    fake = createPgSupabase(db)
  })

  it("create: guarda el caso completo, incluidos recursos sin tipo", async () => {
    const { warnings } = await create(fullForm())
    expect(warnings).toEqual([])
    expect(await count("hechos")).toBe(1)
    expect(await count("victimas")).toBe(2)
    expect(await count("casos")).toBe(2)
    expect(await count("imputados")).toBe(1)
    expect(await count("instancias_judiciales")).toBe(2)
    expect(await count("fechas_juicio")).toBe(2)
    expect(await count("seguimiento")).toBe(1)
    expect(await count("recursos")).toBe(3)

    const recs = (await db.query("select titulo, tipo, url, victima_id is not null as de_victima from recursos order by titulo")).rows
    expect(recs).toContainEqual({ titulo: "Foto de Ana", tipo: "other", url: "https://www.diario.com/ana", de_victima: true })
    expect(recs).toContainEqual(expect.objectContaining({ titulo: "Resolución", url: "/api/files/casos/r.pdf" }))

    const hecho = (await db.query("select h.victima_id, v.nombre_completo from hechos h join victimas v on v.id = h.victima_id")).rows[0]
    expect(hecho.nombre_completo).toBe("Ana Pérez")
  })

  it("create: si falla a mitad, deshace TODO lo creado en ese intento y no toca datos previos", async () => {
    await create(fullForm()) // caso preexistente
    const before = await Promise.all(["hechos", "victimas", "casos", "recursos", "imputados"].map(count))

    fake.failOn({ table: "seguimiento", op: "insert" })
    await expect(create(fullForm())).rejects.toMatchObject({ message: expect.stringContaining("seguimiento") })

    const after = await Promise.all(["hechos", "victimas", "casos", "recursos", "imputados"].map(count))
    expect(after).toEqual(before)
    expect(await count("instancias_judiciales")).toBe(2)
    expect(await count("fechas_juicio")).toBe(2)
  })

  it("create: un recurso que falla ya NO se pierde en silencio (se revierte y se informa)", async () => {
    fake.failOn({ table: "recursos", op: "insert", when: (rows) => rows[0]?.titulo === "Nota imp" })
    await expect(create(fullForm())).rejects.toBeTruthy()
    expect(await count("victimas")).toBe(0)
    expect(await count("hechos")).toBe(0)
  })

  it("instancia judicial que falla -> warning, el resto se guarda", async () => {
    fake.failOn({ table: "instancias_judiciales", op: "insert", times: 1 })
    const { warnings } = await create(fullForm())
    expect(warnings).toEqual(['instancia judicial "C-1"'])
    expect(await count("instancias_judiciales")).toBe(1)
    expect(await count("casos")).toBe(2)
  })

  describe("edit", () => {
    async function seedAndLoad() {
      await create(fullForm())
      const caso = (await db.query("select * from casos order by created_at limit 1")).rows[0]
      const v = (await db.query("select * from victimas order by nombre_completo")).rows
      const imp = (await db.query("select * from imputados")).rows[0]
      const inst = (await db.query("select * from instancias_judiciales order by numero_causa")).rows
      const recs = (await db.query("select * from recursos")).rows
      const general = recs.find((r: any) => r.victima_id === null && r.imputado_id === null)
      return { caso, v, imp, inst, recs, general }
    }

    const editForm = (s: Awaited<ReturnType<typeof seedAndLoad>>, over: Record<string, any> = {}) => ({
      victims: s.v.map((row: any) => victim({ id: row.id, nombreCompleto: row.nombre_completo })),
      incident: { provincia: "Córdoba", municipio: "Capital", estadoCaso: "Elevado a Juicio" },
      accused: [
        {
          id: s.imp.id,
          apellidoNombre: "Imputado Uno (editado)",
          trialDates: ["2025-01-01"],
          instanciasJudiciales: [{ id: s.inst[0].id, numeroCausa: "C-1b", fiscalFiscalia: "UFI 9" }],
          resources: [],
        },
      ],
      followUp: { notasSeguimiento: "editado" },
      resources: [{ id: s.general.id, tipo: "Resolución", titulo: "Resolución v2", url: s.general.url }],
      ...over,
    })

    const edit = (s: any, formData: any, resourcesToDelete: string[] = []) =>
      saveCase({
        supabase: fake.client,
        mode: "edit",
        caseId: s.caso.id,
        formData,
        realIds: { victimaId: s.caso.victima_id, hechoId: s.caso.hecho_id, casoId: s.caso.id },
        resourcesToDelete,
      })

    it("actualiza hecho, imputado, instancias, fechas, seguimiento y recursos", async () => {
      const s = await seedAndLoad()
      const { warnings } = await edit(s, editForm(s))
      expect(warnings).toEqual([])
      expect((await db.query("select provincia from hechos")).rows[0].provincia).toBe("Córdoba")
      expect((await db.query("select distinct estado from casos")).rows).toEqual([{ estado: "Elevado a Juicio" }])
      expect((await db.query("select apellido_nombre from imputados")).rows[0].apellido_nombre).toContain("editado")
      expect((await db.query("select numero_causa from instancias_judiciales")).rows).toEqual([{ numero_causa: "C-1b" }])
      expect((await db.query("select fecha_audiencia::text f from fechas_juicio")).rows).toEqual([{ f: "2025-01-01" }])
      expect(await count("seguimiento")).toBe(1)
      expect((await db.query("select notas_seguimiento from seguimiento")).rows[0].notas_seguimiento).toBe("editado")
      expect((await db.query("select titulo from recursos where id=$1", [s.general.id])).rows[0].titulo).toBe("Resolución v2")
      // Recursos ya guardados de víctima e imputado que no vienen en el form
      // (el form sólo trae los nuevos) se conservan: víctima + imputado + general.
      expect(await count("recursos")).toBe(3)
    })

    it("si falla el reemplazo de fechas de juicio, se restauran las anteriores", async () => {
      const s = await seedAndLoad()
      fake.failOn({ table: "fechas_juicio", op: "insert", times: 1 })
      await expect(edit(s, editForm(s))).rejects.toBeTruthy()
      const fechas = (await db.query("select fecha_audiencia::text f from fechas_juicio order by 1")).rows.map((r: any) => r.f)
      expect(fechas).toEqual(["2024-05-01", "2024-06-01"])
    })

    it("eliminar recurso: borra la fila y después el archivo", async () => {
      const s = await seedAndLoad()
      await edit(s, editForm(s, { resources: [] }), [s.general.id])
      expect((await db.query("select 1 from recursos where id=$1", [s.general.id])).rowCount).toBe(0)
      expect(fake.storageRemoved).toEqual([["casos/r.pdf"]])
    })

    it("si el delete de la fila falla, el archivo NO se borra", async () => {
      const s = await seedAndLoad()
      fake.failOn({ table: "recursos", op: "delete" })
      await expect(edit(s, editForm(s, { resources: [] }), [s.general.id])).rejects.toBeTruthy()
      expect(fake.storageRemoved).toEqual([])
      expect((await db.query("select 1 from recursos where id=$1", [s.general.id])).rowCount).toBe(1)
    })

    it("agregar una víctima nueva en edición crea víctima + caso en el mismo hecho", async () => {
      const s = await seedAndLoad()
      const form = editForm(s)
      form.victims.push(victim({ nombreCompleto: "Nueva", resources: [{ id: "temp-x", titulo: "solo título" }] }))
      await edit(s, form)
      expect(await count("victimas")).toBe(3)
      expect((await db.query("select count(distinct hecho_id) n, count(*) c from casos")).rows[0]).toEqual({ n: "1", c: "3" })
      expect((await db.query("select tipo from recursos where titulo='solo título'")).rows[0].tipo).toBe("other")
    })

    it("quitar un imputado del form borra sus instancias, fechas y recursos", async () => {
      const s = await seedAndLoad()
      await edit(s, editForm(s, { accused: [] }))
      expect(await count("imputados")).toBe(0)
      expect(await count("instancias_judiciales")).toBe(0)
      expect(await count("fechas_juicio")).toBe(0)
      expect((await db.query("select 1 from recursos where imputado_id is not null")).rowCount).toBe(0)
    })

    it("ficha vieja sin hecho: guarda la víctima y avisa", async () => {
      const s = await seedAndLoad()
      const form = editForm(s)
      form.victims[0].nombreCompleto = "Renombrada"
      await expect(
        saveCase({
          supabase: fake.client,
          mode: "edit",
          caseId: s.caso.id,
          formData: form,
          realIds: { victimaId: s.v[0].id, hechoId: null, casoId: null },
          resourcesToDelete: [],
        }),
      ).rejects.toMatchObject({ message: expect.stringContaining("no tiene un hecho") })
      expect((await db.query("select 1 from victimas where nombre_completo='Renombrada'")).rowCount).toBe(1)
    })
  })
})
