/* Service worker de la base de Usina de Justicia.
 *
 * Política de datos (decisión del equipo): SOLO se guarda en el dispositivo
 * la "cáscara" de la app (JS/CSS con hash, íconos y la página offline).
 * NUNCA se cachean páginas con datos, respuestas de /api ni de Supabase:
 * si se pierde un teléfono, no quedan datos de víctimas en él.
 *
 * Además recibe las notificaciones push y abre la pantalla correspondiente.
 */

const VERSION = "v1"
const SHELL_CACHE = `usina-shell-${VERSION}`
const STATIC_CACHE = `usina-static-${VERSION}`
const OFFLINE_URL = "/offline.html"
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/icons/badge-96.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, STATIC_CACHE])
      for (const key of await caches.keys()) {
        if (key.startsWith("usina-") && !keep.has(key)) await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)

  // Otros orígenes (Supabase, APIs públicas): el navegador los maneja directo.
  if (url.origin !== self.location.origin) return

  // Navegación: siempre red. Sin conexión, la página offline (sin datos).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
    )
    return
  }

  // Assets de Next con hash en el nombre (inmutables): cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok && res.type === "basic") cache.put(req, res.clone())
        return res
      }),
    )
  }
  // Todo lo demás (/api, RSC, imágenes optimizadas, etc.): sin intervención.
})

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

function safeInternalUrl(raw) {
  try {
    const u = new URL(raw || "/notificaciones", self.location.origin)
    return u.origin === self.location.origin ? u.pathname + u.search : "/notificaciones"
  } catch {
    return "/notificaciones"
  }
}

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: "Usina de Justicia", body: event.data ? event.data.text() : "" }
  }

  const title = data.title || "Usina de Justicia"
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: data.id || undefined,
    renotify: false,
    data: { url: safeInternalUrl(data.url), id: data.id || null },
    lang: "es-AR",
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options)
      // Avisar a las pestañas abiertas para que refresquen la campanita.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      for (const w of windows) w.postMessage({ type: "notificacion-recibida", id: data.id || null })
    })(),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = safeInternalUrl(event.notification.data && event.notification.data.url)

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          await w.focus()
          if ("navigate" in w) await w.navigate(target)
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
