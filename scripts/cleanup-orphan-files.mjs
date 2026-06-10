// =============================================================================
// Limpieza de archivos huérfanos en el bucket `archivos-casos`.
// =============================================================================
// Compara los objetos del bucket contra `recursos.archivo_path`. Todo
// archivo del bucket que ninguna fila de `recursos` referencia es un
// huérfano (quedó de borrados viejos que no limpiaban storage).
//
// Uso (desde la raíz del repo, con Node 18+):
//
//   # 1. Dry-run: lista los huérfanos, NO borra nada
//   SUPABASE_URL=https://<proyecto>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   node scripts/cleanup-orphan-files.mjs
//
//   # 2. Borrado real (después de revisar el dry-run)
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/cleanup-orphan-files.mjs --delete
//
// Requiere la SERVICE ROLE key (no la anon) porque el bucket es privado
// y el borrado vía API necesita permisos plenos. NO commitear la key ni
// pegarla en ningún chat; pasala sólo como variable de entorno.
// =============================================================================

import { createClient } from "@supabase/supabase-js"

const BUCKET = "archivos-casos"
const DELETE_MODE = process.argv.includes("--delete")

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno.")
  process.exit(1)
}

const supabase = createClient(url, key)

/** Lista recursivamente todos los archivos del bucket. */
async function listAllFiles(prefix = "") {
  const files = []
  let offset = 0
  const PAGE = 1000

  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: PAGE,
      offset,
      sortBy: { column: "name", order: "asc" },
    })
    if (error) throw new Error(`Error listando "${prefix}": ${error.message}`)
    if (!data || data.length === 0) break

    for (const entry of data) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id === null) {
        // Sin id = es una "carpeta" (prefijo). Descender.
        files.push(...(await listAllFiles(fullPath)))
      } else {
        files.push(fullPath)
      }
    }

    if (data.length < PAGE) break
    offset += PAGE
  }

  return files
}

/** Trae todos los archivo_path referenciados en la tabla recursos. */
async function listReferencedPaths() {
  const paths = new Set()
  let from = 0
  const PAGE = 1000

  while (true) {
    const { data, error } = await supabase
      .from("recursos")
      .select("archivo_path")
      .not("archivo_path", "is", null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Error leyendo recursos: ${error.message}`)
    if (!data || data.length === 0) break

    for (const row of data) {
      if (row.archivo_path) paths.add(row.archivo_path)
    }
    if (data.length < PAGE) break
    from += PAGE
  }

  return paths
}

async function main() {
  console.log(`Bucket: ${BUCKET}`)
  console.log(`Modo: ${DELETE_MODE ? "BORRADO REAL" : "dry-run (no borra nada)"}\n`)

  const [allFiles, referenced] = await Promise.all([listAllFiles(), listReferencedPaths()])

  console.log(`Archivos en el bucket:        ${allFiles.length}`)
  console.log(`Paths referenciados en BD:    ${referenced.size}`)

  const orphans = allFiles.filter((f) => !referenced.has(f))

  // Sanity check inverso: filas de recursos cuyo archivo ya no existe.
  const filesSet = new Set(allFiles)
  const danglingRows = [...referenced].filter((p) => !filesSet.has(p))

  console.log(`Huérfanos (en bucket, sin fila): ${orphans.length}`)
  console.log(`Filas con archivo inexistente:   ${danglingRows.length}\n`)

  if (danglingRows.length > 0) {
    console.log("⚠ Filas de `recursos` que apuntan a archivos que ya no existen")
    console.log("  (revisar a mano, este script no las toca):")
    for (const p of danglingRows) console.log(`  - ${p}`)
    console.log("")
  }

  if (orphans.length === 0) {
    console.log("No hay archivos huérfanos. Nada que hacer.")
    return
  }

  console.log("Archivos huérfanos:")
  for (const f of orphans) console.log(`  - ${f}`)

  if (!DELETE_MODE) {
    console.log(`\nDry-run terminado. Para borrarlos de verdad: agregá --delete`)
    return
  }

  // El API de storage acepta hasta ~100 paths por llamada con seguridad.
  const CHUNK = 100
  let deleted = 0
  for (let i = 0; i < orphans.length; i += CHUNK) {
    const chunk = orphans.slice(i, i + CHUNK)
    const { error } = await supabase.storage.from(BUCKET).remove(chunk)
    if (error) {
      console.error(`Error borrando lote ${i / CHUNK + 1}: ${error.message}`)
      process.exit(1)
    }
    deleted += chunk.length
    console.log(`Borrados ${deleted}/${orphans.length}...`)
  }

  console.log(`\n✔ Limpieza completa: ${deleted} archivos huérfanos eliminados.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
