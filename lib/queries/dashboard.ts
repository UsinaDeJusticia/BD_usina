"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { fetchDashboardStats, type DashboardStats } from "@/lib/data/dashboard"
import { queryKeys } from "@/lib/queries/keys"

/**
 * KPIs + agregados del dashboard. Una sola RPC compartida por las 4
 * secciones (cards, chart anual, chart de estado, mapa) — todas
 * suscriben a la misma queryKey.
 */
export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: queryKeys.dashboardStats,
    queryFn: () => fetchDashboardStats(createClient()),
  })
}
