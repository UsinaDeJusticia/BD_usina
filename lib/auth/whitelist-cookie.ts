// Cookie firmada (HMAC-SHA256) que cachea el chequeo de whitelist del
// middleware. Sin esto, cada request autenticado pega a `allowed_users`
// además de a `auth.getUser()`. Con esto, mientras la cookie sea válida
// (15 min) y el email matchee, no hay query a la BD.
//
// El secret se pasa por env var `WHITELIST_COOKIE_SECRET`. Si no está
// seteado, el cacheo se deshabilita silenciosamente y se hace fallback
// a la query directa (sin regresión funcional, sólo sin la mejora).
//
// Edge Runtime compatible: usa Web Crypto API (`crypto.subtle`).

export const WHITELIST_COOKIE_NAME = "usina_wl"

const TTL_MS = 15 * 60 * 1000
const encoder = new TextEncoder()

function base64UrlEncode(bytes: Uint8Array | string): string {
  const raw =
    typeof bytes === "string"
      ? bytes
      : String.fromCharCode(...bytes)
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function base64UrlDecodeToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/")
    .padEnd(Math.ceil(s.length / 4) * 4, "=")
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

/** Firma `${email}|${expiryMs}` y devuelve `${b64payload}.${b64sig}`. */
export async function makeWhitelistCookie(
  email: string,
  secret: string,
): Promise<string> {
  const expiry = Date.now() + TTL_MS
  const payload = `${email}|${expiry}`
  const key = await importKey(secret)
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
  return `${base64UrlEncode(payload)}.${base64UrlEncode(new Uint8Array(sig))}`
}

/** Devuelve true sólo si la cookie es válida, no expiró y el email coincide. */
export async function verifyWhitelistCookie(
  cookie: string | undefined,
  email: string,
  secret: string,
): Promise<boolean> {
  if (!cookie) return false
  const dot = cookie.indexOf(".")
  if (dot < 0) return false
  const payloadB64 = cookie.slice(0, dot)
  const sigB64 = cookie.slice(dot + 1)

  let payload: string
  let sigBytes: Uint8Array
  try {
    payload = new TextDecoder().decode(base64UrlDecodeToBytes(payloadB64))
    sigBytes = base64UrlDecodeToBytes(sigB64)
  } catch {
    return false
  }

  const key = await importKey(secret)
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    encoder.encode(payload),
  )
  if (!ok) return false

  const sep = payload.indexOf("|")
  if (sep < 0) return false
  const cookieEmail = payload.slice(0, sep)
  const expiryStr = payload.slice(sep + 1)
  if (cookieEmail !== email) return false
  const expiry = Number(expiryStr)
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false

  return true
}

export const WHITELIST_COOKIE_MAX_AGE_SECONDS = Math.floor(TTL_MS / 1000)
