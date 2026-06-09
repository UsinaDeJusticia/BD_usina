// Data layer para el dashboard estadístico.
//
// Antes: cada tarjeta/gráfico hacía su propio fetch y traía la tabla
// entera para contar en JS. Ahora: una sola RPC (`get_dashboard_stats`)
// devuelve todos los agregados en ~1 KB.
//
// Para deduplicar los 4 mounts simultáneos del dashboard se incluye un
// in-flight share + TTL corto. Cache real (invalidación al editar casos,
// staleTime configurable, etc.) llega en Fase 3 con React Query.

import type { SupabaseClient } from "@supabase/supabase-js"

export interface DashboardKPIs {
  totalCases: number
  casesLastYear: number
  casesWithoutConviction: number
  casesInInvestigation: number
}

export interface YearlyData {
  year: string
  cases: number
}

export interface ProvinceData {
  provincia: string
  cases: number
}

export interface StatusData {
  status: string
  cases: number
}

export interface DashboardStats {
  kpis: DashboardKPIs
  casesByYear: YearlyData[]
  casesByProvince: ProvinceData[]
  casesByStatus: StatusData[]
}

const TTL_MS = 30_000

let inFlight: Promise<DashboardStats> | null = null
let cached: { ts: number; data: DashboardStats } | null = null

export async function fetchDashboardStats(
  supabase: SupabaseClient,
): Promise<DashboardStats> {
  const now = Date.now()
  if (cached && now - cached.ts < TTL_MS) return cached.data
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const { data, error } = await supabase.rpc("get_dashboard_stats")
      if (error) throw error
      const stats = data as DashboardStats
      cached = { ts: Date.now(), data: stats }
      return stats
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}
