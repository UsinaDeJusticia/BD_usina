/** @type {import('next').NextConfig} */

// Origen del proyecto Supabase (REST, Auth, Storage y Realtime).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://*.supabase.co"
const supabaseWs = supabaseUrl.replace(/^http/, "ws")

// Content-Security-Policy en modo REPORT-ONLY: el navegador NO bloquea nada,
// sólo informa violaciones en la consola. Así se valida la política en
// producción sin riesgo de romper la app. Cuando la consola esté limpia,
// renombrar la key a "Content-Security-Policy" para hacerla efectiva.
const cspDirectives = [
  "default-src 'self'",
  // Next.js inyecta scripts inline para la hidratación.
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  // Recursos de casos pueden ser imágenes externas (notas de prensa).
  `img-src 'self' data: blob: https:`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl} ${supabaseWs} https://apis.datos.gob.ar https://restcountries.com https://va.vercel-scripts.com`,
  // Preview de PDFs/videos: /api/files redirige a un signed URL de Supabase.
  `frame-src 'self' ${supabaseUrl}`,
  `media-src 'self' blob: ${supabaseUrl}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
]

// Headers de seguridad aplicados a todas las rutas.
// Set "safe": no rompen integraciones existentes (Supabase, Resend, Google OAuth).
const securityHeaders = [
  {
    key: "Content-Security-Policy-Report-Only",
    value: cspDirectives.join("; "),
  },
  // Forzar HTTPS por 2 años (con preload elegibilidad).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Evitar clickjacking: nadie puede embeber la app en un iframe.
  // Si alguna vez se necesita embeber desde el mismo dominio, cambiar a SAMEORIGIN.
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // El navegador respeta el Content-Type declarado y no "adivina" tipos peligrosos.
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // Mandar solo origin en navegaciones cross-site (no full URL con query/path).
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // Negar acceso a APIs sensibles del navegador que la app no usa.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Permitir DNS prefetch (mejora perf, no es riesgo de seguridad).
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
]

const nextConfig = {
  // Los errores de TypeScript vuelven a frenar el build (antes se ignoraban
  // y escondían bugs reales). CI corre `npm run typecheck` en cada PR.
  typescript: {
    ignoreBuildErrors: false,
  },
  // Optimización de imágenes de Next activada (sólo se usa con assets
  // locales: logos). Sirve WebP/AVIF redimensionado en vez del PNG original.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Lint: `npm run lint` usa la config de eslint.config.mjs. No bloquea el
  // build de Vercel para no frenar un deploy urgente por un warning de estilo;
  // sí se corre en CI.
  eslint: {
    ignoreDuringBuilds: true,
  },
  poweredByHeader: false,

  async headers() {
    return [
      {
        // Aplica a todas las rutas.
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
