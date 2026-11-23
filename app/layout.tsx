import type React from "react"
import type { Metadata, Viewport } from "next"
import { Lato, Montserrat } from "next/font/google"
import "./globals.css"
import { AuthGuard } from "@/components/auth/auth-guard"
import { SupabaseListener } from "@/components/auth/supabase-listener"
import { QueryProvider } from "@/components/providers/query-provider"
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register"
import { Toaster } from "@/components/ui/toaster"

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-lato",
  display: "swap",
})

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Usina de Justicia - Base de Datos de Víctimas",
  description: "Sistema de seguimiento y registro de casos de inseguridad",
  generator: "v0.app",
  applicationName: "Usina BD",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Usina BD",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: "#1e3a8a",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${lato.variable} ${montserrat.variable}`}>
      <body className="font-sans antialiased bg-slate-50 text-slate-900">
        <QueryProvider>
          <SupabaseListener />
          <ServiceWorkerRegister />
          <AuthGuard>{children}</AuthGuard>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  )
}
