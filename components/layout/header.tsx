"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LogOut, BarChart3, ListChecks } from "lucide-react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { useCandidatosPendientes } from "@/lib/queries/candidatos"

export function Header() {
  const pathname = usePathname()
  const supabase = createClient()
  // Cuenta de candidatos de Mapa del Delito pendientes de revisión. Se
  // sirve del mismo cache de TanStack Query que usa /candidatos —
  // ambos comparten queryKeys.candidatosPendientes.
  const { data: candidatos } = useCandidatosPendientes()
  const pendientesCount = candidatos?.length ?? 0

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/images/logo-usina-justicia.png"
                alt="Usina de Justicia"
                width={120}
                height={40}
                className="h-10 w-auto"
              />
            </Link>

            <nav className="hidden md:flex space-x-6">
              <Link
                href="/"
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  pathname === "/"
                    ? "bg-blue-50 text-blue-900 border border-blue-200"
                    : "text-slate-600 hover:text-blue-700 hover:bg-blue-50"
                }`}
              >
                Casos
              </Link>
              <Link
                href="/dashboard"
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                  pathname === "/dashboard"
                    ? "bg-blue-50 text-blue-900 border border-blue-200"
                    : "text-slate-600 hover:text-blue-700 hover:bg-blue-50"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </Link>
              <Link
                href="/candidatos"
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                  pathname === "/candidatos"
                    ? "bg-blue-50 text-blue-900 border border-blue-200"
                    : "text-slate-600 hover:text-blue-700 hover:bg-blue-50"
                }`}
              >
                <ListChecks className="w-4 h-4" />
                Candidatos
                {pendientesCount > 0 && (
                  <Badge className="bg-blue-600 hover:bg-blue-600 text-white h-5 min-w-5 px-1.5 justify-center">
                    {pendientesCount}
                  </Badge>
                )}
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 bg-transparent"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
