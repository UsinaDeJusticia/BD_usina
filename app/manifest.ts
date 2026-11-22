import type { MetadataRoute } from "next"

// Web App Manifest: permite instalar la base como app (PWA) en celulares y
// computadoras. Next lo sirve en /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Usina de Justicia — Base de Datos de Víctimas",
    short_name: "Usina BD",
    description: "Sistema de seguimiento y registro de casos de Usina de Justicia",
    lang: "es-AR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#1e3a8a",
    categories: ["productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nuevo caso", url: "/casos/nuevo", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Notificaciones", url: "/notificaciones", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  }
}
