// Fake MÍNIMO del cliente supabase-js respaldado por un Postgres real.
// Cubre sólo la API que usa lib/cases/save-case.ts:
//   from(t).select(cols).eq().in().is().order().limit().single()/maybeSingle()
//   from(t).insert(rows).select().single()
//   from(t).update(obj).eq()/in()
//   from(t).delete().eq()/in()
//   storage.from(b).remove(paths)
// Permite inyectar fallas por tabla/operación para probar rollbacks.
import type { Client } from "pg"

type Op = "select" | "insert" | "update" | "delete"
type Filter = { col: string; kind: "eq" | "in" | "is"; value: unknown }
export type FailRule = { table: string; op: Op; times?: number; when?: (payload: any) => boolean }

export function createPgSupabase(db: Client) {
  const colTypes = new Map<string, Map<string, string>>()
  const failRules: FailRule[] = []
  const storageRemoved: string[][] = []

  async function types(table: string) {
    if (!colTypes.has(table)) {
      const r = await db.query(
        "select column_name, data_type from information_schema.columns where table_schema='public' and table_name=$1",
        [table],
      )
      colTypes.set(table, new Map(r.rows.map((x: any) => [x.column_name, x.data_type])))
    }
    return colTypes.get(table)!
  }

  function shouldFail(table: string, op: Op, payload: unknown) {
    const rule = failRules.find((r) => r.table === table && r.op === op && (!r.when || r.when(payload)))
    if (!rule) return false
    if (rule.times !== undefined) {
      rule.times--
      if (rule.times <= 0) failRules.splice(failRules.indexOf(rule), 1)
    }
    return true
  }

  function serialize(t: Map<string, string>, col: string, v: unknown) {
    if (v !== null && typeof v === "object" && t.get(col) === "jsonb") return JSON.stringify(v)
    return v
  }

  class Builder implements PromiseLike<any> {
    private op: Op = "select"
    private cols = "*"
    private rows: Record<string, unknown>[] = []
    private patch: Record<string, unknown> = {}
    private filters: Filter[] = []
    private orderBy?: { col: string; asc: boolean }
    private lim?: number
    private mode: "many" | "single" | "maybe" = "many"
    private returning = false
    constructor(private table: string) {}

    select(cols = "*") {
      if (this.op === "insert" || this.op === "update") this.returning = true
      else this.op = "select"
      this.cols = cols
      return this
    }
    insert(rows: Record<string, unknown>[] | Record<string, unknown>) {
      this.op = "insert"
      this.rows = Array.isArray(rows) ? rows : [rows]
      return this
    }
    update(patch: Record<string, unknown>) {
      this.op = "update"
      this.patch = patch
      return this
    }
    delete() {
      this.op = "delete"
      return this
    }
    eq(col: string, value: unknown) {
      this.filters.push({ col, kind: "eq", value })
      return this
    }
    in(col: string, value: unknown[]) {
      this.filters.push({ col, kind: "in", value })
      return this
    }
    is(col: string, value: unknown) {
      this.filters.push({ col, kind: "is", value })
      return this
    }
    order(col: string, opts?: { ascending?: boolean }) {
      this.orderBy = { col, asc: opts?.ascending !== false }
      return this
    }
    limit(n: number) {
      this.lim = n
      return this
    }
    single() {
      this.mode = "single"
      return this
    }
    maybeSingle() {
      this.mode = "maybe"
      return this
    }

    private where(params: unknown[]) {
      if (this.filters.length === 0) return ""
      const parts = this.filters.map((f) => {
        if (f.kind === "is") return `"${f.col}" is ${f.value === null ? "null" : "not null"}`
        params.push(f.value)
        return f.kind === "eq" ? `"${f.col}" = $${params.length}` : `"${f.col}" = any($${params.length})`
      })
      return " where " + parts.join(" and ")
    }

    async run(): Promise<{ data: any; error: any }> {
      const payload = this.op === "insert" ? this.rows : this.op === "update" ? this.patch : this.filters
      if (shouldFail(this.table, this.op, payload)) {
        return { data: null, error: { message: `falla inyectada en ${this.op} ${this.table}`, code: "TEST" } }
      }
      try {
        const t = await types(this.table)
        const params: unknown[] = []
        let sql: string
        if (this.op === "insert") {
          const out: any[] = []
          for (const row of this.rows) {
            const keys = Object.keys(row)
            const p: unknown[] = keys.map((k) => serialize(t, k, row[k]))
            sql = `insert into public."${this.table}" (${keys.map((k) => `"${k}"`).join(",")}) values (${keys
              .map((_, i) => `$${i + 1}`)
              .join(",")}) returning *`
            const r = await db.query(sql, p)
            out.push(...r.rows)
          }
          return this.shape(this.returning ? out : null)
        }
        if (this.op === "update") {
          const keys = Object.keys(this.patch)
          keys.forEach((k) => params.push(serialize(t, k, this.patch[k])))
          sql = `update public."${this.table}" set ${keys.map((k, i) => `"${k}" = $${i + 1}`).join(",")}`
          sql += this.where(params) + " returning *"
          const r = await db.query(sql, params)
          return this.shape(this.returning ? r.rows : null)
        }
        if (this.op === "delete") {
          sql = `delete from public."${this.table}"` + this.where(params)
          await db.query(sql, params)
          return { data: null, error: null }
        }
        const cols = this.cols === "*" ? "*" : this.cols.split(",").map((c) => `"${c.trim()}"`).join(",")
        sql = `select ${cols} from public."${this.table}"` + this.where(params)
        if (this.orderBy) sql += ` order by "${this.orderBy.col}" ${this.orderBy.asc ? "asc" : "desc"}`
        if (this.lim !== undefined) sql += ` limit ${this.lim}`
        const r = await db.query(sql, params)
        return this.shape(r.rows)
      } catch (e: any) {
        return { data: null, error: { message: e.message, code: e.code } }
      }
    }

    private shape(rows: any[] | null) {
      if (rows === null) return { data: null, error: null }
      if (this.mode === "many") return { data: rows, error: null }
      if (rows.length === 1) return { data: rows[0], error: null }
      if (rows.length === 0 && this.mode === "maybe") return { data: null, error: null }
      return { data: null, error: { message: `esperaba 1 fila, hubo ${rows.length}`, code: "PGRST116" } }
    }

    then<TResult1 = any, TResult2 = never>(
      onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      return this.run().then(onfulfilled, onrejected)
    }
  }

  const client = {
    from: (table: string) => new Builder(table),
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          storageRemoved.push(paths)
          return { data: paths, error: null }
        },
      }),
    },
  }

  return {
    client: client as any,
    failOn: (rule: FailRule) => failRules.push(rule),
    clearFailures: () => failRules.splice(0),
    storageRemoved,
  }
}
