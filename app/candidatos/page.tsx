import { Header } from "@/components/layout/header"
import { CandidatosList } from "@/components/candidatos/candidatos-list"

export default function CandidatosPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 font-heading mb-2">Candidatos de Mapa del Delito</h2>
          <p className="text-slate-600">
            Víctimas detectadas por scraping de noticias, pendientes de revisión antes de incorporarse a BD Usina.
          </p>
        </div>

        <CandidatosList />
      </main>
    </div>
  )
}
