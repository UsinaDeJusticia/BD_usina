/** @type {import('next').NextConfig} */

// Headers de seguridad aplicados a todas las rutas.
// Set "safe": no rompen integraciones existentes (Supabase, Resend, Google OAuth).
// CSP queda pendiente para una pasada con monitoreo (Report-Only primero).
const securityHeaders = [
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
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

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
