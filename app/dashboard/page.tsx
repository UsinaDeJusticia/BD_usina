import { Header } from "@/components/layout/header"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { CasesByYearChart } from "@/components/dashboard/cases-by-year-chart"
import { StatusDistributionChart } from "@/components/dashboard/status-distribution-chart"
import { ProvinceMap } from "@/components/dashboard/province-map"
import { ProvinceRankingChart } from "@/components/dashboard/province-ranking-chart"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 font-heading mb-2">Dashboard Estadístico</h2>
          <p className="text-slate-600">Análisis y visualización de datos del observatorio</p>
        </div>

        {/* KPI Cards */}
        <DashboardStats />

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <CasesByYearChart />
          <StatusDistributionChart />
        </div>

        {/* Mapa y ranking por provincia */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2">
            <ProvinceMap />
          </div>
          <ProvinceRankingChart />
        </div>
      </main>
    </div>
  )
}
