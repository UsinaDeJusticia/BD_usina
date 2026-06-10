// Data layer para el dashboard estadístico.
//
// Una sola RPC (`get_dashboard_stats`) devuelve todos los agregados que
// consume el dashboard en ~1 KB, en lugar de las 5 queries que bajaban
// tablas enteras y contaban en JS.
//
// El cacheo, dedupe y manejo de stale-while-revalidate los hace React
// Query a través de `useDashboardStats` (ver `lib/queries/dashboard.ts`).

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

export async function fetchDashboardStats(
  supabase: SupabaseClient,
): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc("get_dashboard_stats")
  if (error) throw error
  return data as DashboardStats
}
