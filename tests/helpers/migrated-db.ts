import { readdirSync, readFileSync } from "node:fs"
import { Client } from "pg"

const MIGRATIONS_DIR = new URL("../../supabase/migrations/", import.meta.url)
const SHIM = new URL("../fixtures/supabase-shim.sql", import.meta.url)

/** Archivos de supabase/migrations en el orden en que los aplica la CLI. */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{14}_.+\.sql$/.test(f))
    .sort()
}

/**
 * Crea una base nueva `name` en el servidor de `adminUrl`, le aplica la capa
 * que simula Supabase y TODAS las migraciones reales, y devuelve un cliente
 * conectado a ella. Llamar a `drop()` al terminar.
 */
export async function createMigratedDb(adminUrl: string, name: string) {
  const admin = new Client({ connectionString: adminUrl })
  await admin.connect()
  await admin.query(`drop database if exists ${name}`)
  await admin.query(`create database ${name}`)

  const url = new URL(adminUrl)
  url.pathname = `/${name}`
  const db = new Client({ connectionString: url.toString() })
  await db.connect()
  await db.query(readFileSync(SHIM, "utf8"))
  for (const file of migrationFiles()) {
    try {
      await db.query(readFileSync(new URL(file, MIGRATIONS_DIR), "utf8"))
    } catch (e) {
      throw new Error(`La migración ${file} falló: ${(e as Error).message}`)
    }
  }
  // El dump del esquema base deja la sesión con search_path vacío (y otros
  // ajustes de pg_dump): volver a los valores normales de una conexión.
  await db.query("reset all")

  return {
    db,
    async drop() {
      await db.end()
      await admin.query(`drop database if exists ${name}`)
      await admin.end()
    },
  }
}
