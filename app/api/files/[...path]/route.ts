import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

const BUCKET = "archivos-casos"
const SIGNED_URL_TTL_SECONDS = 60

/**
 * Proxy autenticado a los archivos del bucket privado `archivos-casos`.
 *
 * Flujo:
 *   1. Verifica que el request tenga sesión válida (cookie de Supabase auth).
 *   2. Verifica que el email del usuario esté en la whitelist `allowed_users`.
 *   3. Genera un signed URL de corta duración (60s) y redirecciona al cliente.
 *
 * Por qué redirect y no proxy: redirigir al CDN de Supabase evita pasar el
 * archivo por el servidor Next (ahorra ancho de banda y latencia), y el
 * signed URL ya expira en 60s así que la URL no queda "comprometida" en
 * caché de navegador / historial / referrer.
 *
 * El bucket debe estar marcado public=false en storage.buckets, y las
 * policies de storage.objects deben restringir a authenticated + whitelist
 * para defensa en profundidad (ver scripts/010_secure_storage.sql).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: pathSegments } = await params
  if (!pathSegments || pathSegments.length === 0) {
    return NextResponse.json({ error: "Path requerido" }, { status: 400 })
  }
  const filePath = pathSegments.map(decodeURIComponent).join("/")

  const supabase = await createClient()

  // 1. Auth: sesión válida
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  // 2. Whitelist: email en allowed_users
  const { data: allowed, error: allowedError } = await supabase
    .from("allowed_users")
    .select("email")
    .eq("email", user.email)
    .maybeSingle()
  if (allowedError) {
    return NextResponse.json(
      { error: "Error validando autorización" },
      { status: 500 },
    )
  }
  if (!allowed) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  // 3. Signed URL
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "Archivo no encontrado" },
      { status: 404 },
    )
  }

  return NextResponse.redirect(data.signedUrl, { status: 302 })
}
