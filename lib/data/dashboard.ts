// Data layer para el dashboard estadístico.
//
// Una sola RPC (`get_dashboard_stats`, scripts/012_dashboard_rpc_victimas.sql)
// devuelve todos los agregados. La unidad de conteo es la VÍCTIMA: una víctima
// cuenta mientras tenga al menos un caso, así que borrar un caso se refleja.
//
// El cacheo, dedupe y manejo de stale-while-revalidate los hace React Query a
// través de `useDashboardStats` (ver `lib/queries/dashboard.ts`).

import type { SupabaseClient } from "@supabase/supabase-js"

export interface DashboardKPIs {
  totalVictimas: number
  victimasUltimoAnio: number
  victimasSinCondena: number
}

export interface YearlyData {
  year: string
  victimas: number
}

export interface ProvinceData {
  provincia: string
  victimas: number
}

export interface StatusData {
  status: string
  victimas: number
}

export interface DashboardStats {
  kpis: DashboardKPIs
  victimasByYear: YearlyData[]
  victimasSinFecha: number
  victimasByProvince: ProvinceData[]
  victimasByStatus: StatusData[]
}

export async function fetchDashboardStats(supabase: SupabaseClient): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc("get_dashboard_stats")
  if (error) throw error
  return data as DashboardStats
}
