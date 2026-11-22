// Prueba las migraciones 013 (RLS) y 015 (integridad) contra Postgres real.
// Requiere TEST_DATABASE_URL; sin ella se saltea.
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { Client } from "pg"

const ADMIN_URL = process.env.TEST_DATABASE_URL
const DB_NAME = `usina_sql_${process.pid}`
const run = ADMIN_URL ? describe : describe.skip
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8")

let admin: Client
let db: Client

const A = "a0000000-0000-0000-0000-00000000000a"
const B = "b0000000-0000-0000-0000-00000000000b"
const C = "c0000000-0000-0000-0000-00000000000c"
const H1 = "10000000-0000-0000-0000-000000000001"
const H2 = "20000000-0000-0000-0000-000000000002"
const CASO_A = "ca000000-0000-0000-0000-00000000000a"
const CASO_C = "cc000000-0000-0000-0000-00000000000c"

const SEED = `
insert into allowed_users(email) values ('staff@usina.org');
insert into victimas(id,nombre_completo) values ('${A}','Victima A'),('${B}','Victima B'),('${C}','Victima C');
insert into hechos(id,victima_id,provincia,fecha_hecho) values ('${H1}','${A}','Buenos Aires','2024-01-01'),('${H2}','${C}','Córdoba','2023-05-05');
insert into casos(id,victima_id,hecho_id,created_at) values
  ('${CASO_A}','${A}','${H1}', now()-interval '2 day'),
  ('cb000000-0000-0000-0000-00000000000b','${B}','${H1}', now()-interval '1 day'),
  ('${CASO_C}','${C}','${H2}', now());
insert into imputados(id,hecho_id,apellido_nombre,estado_procesal) values
  ('11000000-0000-0000-0000-000000000001','${H1}','Imp H1','Condenado'),
  ('22000000-0000-0000-0000-000000000002','${H2}','Imp H2','En investigación');
insert into instancias_judiciales(imputado_id,numero_causa) values ('11000000-0000-0000-0000-000000000001','C-1'),('22000000-0000-0000-0000-000000000002','C-2');
insert into fechas_juicio(imputado_id,fecha_audiencia) values ('11000000-0000-0000-0000-000000000001','2025-01-01'),('22000000-0000-0000-0000-000000000002','2025-02-02');
insert into seguimiento(hecho_id,notas_seguimiento) values ('${H1}','seg H1'),('${H2}','seg H2');
insert into recursos(hecho_id,victima_id,imputado_id,tipo,titulo,url) values
  ('${H1}','${A}',null,'Foto','rec A','https://x.org/a'),
  ('${H1}','${B}',null,'Foto','rec B','https://x.org/b'),
  ('${H1}',null,'11000000-0000-0000-0000-000000000001','Nota','rec imp H1',null),
  ('${H2}','${C}',null,'Foto','rec C','javascript:alert(1)'),
  ('${H2}',null,null,'Nota','rec gral H2','/api/files/casos/x.pdf');
`

const TABLES = ["victimas", "hechos", "casos", "imputados", "instancias_judiciales", "fechas_juicio", "seguimiento", "recursos"]
const counts = async () => {
  const out: Record<string, number> = {}
  for (const t of TABLES) out[t] = Number((await db.query(`select count(*) from public.${t}`)).rows[0].count)
  return out
}

/** Ejecuta `sql` con el rol y email dados; devuelve filas o el mensaje de error. */
async function as(role: "anon" | "authenticated", email: string | null, sql: string) {
  await db.query("begin")
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [email ? JSON.stringify({ email }) : ""])
    await db.query(`set local role ${role}`)
    const r = await db.query(sql)
    await db.query("commit")
    return { rows: r.rows, error: null as string | null }
  } catch (e: any) {
    await db.query("rollback")
    return { rows: [], error: e.message as string }
  }
}

run("migraciones SQL 013 / 015", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL })
    await admin.connect()
    await admin.query(`drop database if exists ${DB_NAME}`)
    await admin.query(`create database ${DB_NAME}`)
    const url = new URL(ADMIN_URL!)
    url.pathname = `/${DB_NAME}`
    db = new Client({ connectionString: url.toString() })
    await db.connect()
    await db.query(read("./fixtures/schema.sql"))
    // Peor caso: allowed_users con política abierta (cualquiera se agrega).
    await db.query(`create policy "abierta" on allowed_users for all using (true) with check (true)`)
    await db.query(SEED)
  })

  afterAll(async () => {
    await db?.end()
    if (admin) {
      await admin.query(`drop database if exists ${DB_NAME}`)
      await admin.end()
    }
  })

  it("ANTES de 013 la anon key lee víctimas (el agujero existe)", async () => {
    const r = await as("anon", null, "select count(*)::int n from victimas")
    expect(r.rows[0].n).toBe(3)
  })

  it("013 se aplica sin tocar datos y es re-ejecutable", async () => {
    const before = await counts()
    await db.query(read("../scripts/013_harden_rls.sql"))
    await db.query(read("../scripts/013_harden_rls.sql"))
    expect(await counts()).toEqual(before)
    const backup = await db.query("select count(*)::int n, bool_and(qual = 'true') abiertas from admin_backup.policies_013 where tablename <> 'allowed_users'")
    expect(backup.rows[0]).toEqual({ n: 8, abiertas: true })
  })

  it("anon: sin acceso a tablas, whitelist ni RPC del dashboard", async () => {
    expect((await as("anon", null, "select 1 from victimas")).error).toMatch(/permission denied/)
    expect((await as("anon", null, "select 1 from allowed_users")).error).toMatch(/permission denied/)
    expect((await as("anon", null, "select public.get_dashboard_stats()")).error).toMatch(/permission denied/)
  })

  it("autenticado fuera de la whitelist: no ve ni escribe, ni puede auto-agregarse", async () => {
    const who = "random@gmail.com"
    expect((await as("authenticated", who, "select count(*)::int n from victimas")).rows[0].n).toBe(0)
    expect((await as("authenticated", who, "insert into victimas(nombre_completo) values ('x')")).error).toMatch(/row-level security/)
    expect((await as("authenticated", who, `insert into allowed_users(email) values ('${who}')`)).error).toMatch(/permission denied/)
    expect((await as("authenticated", who, "select count(*)::int n from allowed_users")).rows[0].n).toBe(0)
    await as("authenticated", who, "update casos set estado = 'hackeado'")
    expect((await db.query("select count(*)::int n from casos where estado = 'hackeado'")).rows[0].n).toBe(0)
  })

  it("autenticado en la whitelist: acceso completo, ve sólo su fila de allowed_users", async () => {
    const who = "staff@usina.org"
    expect((await as("authenticated", who, "select count(*)::int n from victimas")).rows[0].n).toBe(3)
    expect((await as("authenticated", who, "select email from allowed_users")).rows).toEqual([{ email: who }])
    const stats = await as("authenticated", who, "select public.get_dashboard_stats() s")
    expect(stats.rows[0].s.kpis.totalCases).toBe(3)
    await db.query("begin")
    await db.query(`select set_config('request.jwt.claims', '{"email":"staff@usina.org"}', true)`)
    await db.query("set local role authenticated")
    await db.query("insert into victimas(nombre_completo) values ('temporal')")
    await db.query("update hechos set provincia = provincia")
    await db.query("rollback")
  })

  it("rollback de 013 restaura las políticas originales y 013 se puede re-aplicar", async () => {
    const before = await counts()
    await db.query(read("../scripts/013_harden_rls_rollback.sql"))
    const pols = await db.query("select policyname from pg_policies where schemaname='public' and tablename='victimas'")
    expect(pols.rows).toEqual([{ policyname: "Allow all operations on victimas" }])
    expect((await as("anon", null, "select count(*)::int n from victimas")).rows[0].n).toBe(3)

    await db.query(read("../scripts/013_harden_rls.sql"))
    expect((await as("anon", null, "select 1 from victimas")).error).toMatch(/permission denied/)
    expect(await counts()).toEqual(before)
  })

  describe("015", () => {
    beforeAll(async () => {
      await db.query(read("../scripts/015_data_integrity.sql"))
      await db.query(read("../scripts/015_data_integrity.sql"))
    })

    it("sólo usuarios de la whitelist pueden usar delete_caso", async () => {
      expect((await as("anon", null, `select delete_caso('${CASO_C}')`)).error).toMatch(/permission denied/)
      expect((await as("authenticated", "random@gmail.com", `select delete_caso('${CASO_C}')`)).error).toMatch(/No autorizado/)
      expect((await counts()).casos).toBe(3)
    })

    it("borrar la víctima principal de un hecho compartido conserva el hecho y a la otra víctima", async () => {
      const r = await as("authenticated", "staff@usina.org", `select delete_caso('${CASO_A}') r`)
      expect(r.error).toBeNull()
      expect(r.rows[0].r).toMatchObject({ ok: true, hecho_eliminado: false, victima_eliminada: true })
      const hecho = await db.query(`select victima_id from hechos where id = '${H1}'`)
      expect(hecho.rows[0].victima_id).toBe(B) // reasignado, sin cascade
      expect((await db.query(`select count(*)::int n from casos where hecho_id = '${H1}'`)).rows[0].n).toBe(1)
      expect((await db.query(`select count(*)::int n from imputados where hecho_id = '${H1}'`)).rows[0].n).toBe(1)
      expect((await db.query(`select count(*)::int n from victimas where id = '${A}'`)).rows[0].n).toBe(0)
    })

    it("borrar un caso con hecho propio no deja huérfanos y guarda snapshot recuperable", async () => {
      const r = await as("authenticated", "staff@usina.org", `select delete_caso('${CASO_C}') r`)
      expect(r.rows[0].r).toMatchObject({ ok: true, hecho_eliminado: true, victima_eliminada: true })
      for (const [t, col] of [["hechos", "id"], ["seguimiento", "hecho_id"], ["imputados", "hecho_id"], ["recursos", "hecho_id"]]) {
        expect((await db.query(`select count(*)::int n from ${t} where ${col} = '${H2}'`)).rows[0].n).toBe(0)
      }
      const snap = (await db.query(`select snapshot from admin_backup.casos_eliminados where caso_id = '${CASO_C}'`)).rows[0].snapshot
      expect(snap.victima.nombre_completo).toBe("Victima C")
      expect(snap.hecho.provincia).toBe("Córdoba")
      expect(snap.imputados).toHaveLength(1)
      expect(snap.instancias_judiciales).toHaveLength(1)
      expect(snap.fechas_juicio).toHaveLength(1)
      expect(snap.seguimiento).toHaveLength(1)

      // Recuperación desde el snapshot.
      await db.query("begin")
      await db.query(`insert into victimas select * from jsonb_populate_record(null::victimas, $1)`, [snap.victima])
      await db.query(`insert into hechos select * from jsonb_populate_record(null::hechos, $1)`, [snap.hecho])
      await db.query(`insert into casos select * from jsonb_populate_record(null::casos, $1)`, [snap.caso])
      expect((await db.query(`select count(*)::int n from casos where id = '${CASO_C}'`)).rows[0].n).toBe(1)
      await db.query("rollback")
    })

    it("los snapshots no son legibles desde la API", async () => {
      expect((await as("authenticated", "staff@usina.org", "select 1 from admin_backup.casos_eliminados")).error).toMatch(
        /permission denied/,
      )
    })

    it("CHECK de URL: bloquea javascript:/data:, permite http(s) y /api/files", async () => {
      const ins = (url: string) =>
        as("authenticated", "staff@usina.org", `insert into recursos(hecho_id,tipo,titulo,url) values ('${H1}','Nota','t','${url}')`)
      expect((await ins("javascript:alert(1)")).error).toMatch(/recursos_url_http_check/)
      expect((await ins("data:text/html,x")).error).toMatch(/recursos_url_http_check/)
      expect((await ins("https://ok.org")).error).toBeNull()
      expect((await ins("/api/files/casos/a.pdf")).error).toBeNull()
      expect((await ins("")).error).toBeNull()
    })

    it("bucket con límite de tamaño y sin SVG", async () => {
      const b = (await db.query("select file_size_limit, allowed_mime_types from storage.buckets where id='archivos-casos'")).rows[0]
      expect(Number(b.file_size_limit)).toBe(52428800)
      expect(b.allowed_mime_types).toContain("application/pdf")
      expect(b.allowed_mime_types).not.toContain("image/svg+xml")
    })
  })
})
