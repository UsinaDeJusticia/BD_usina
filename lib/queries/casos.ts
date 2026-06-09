"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { fetchCasesList, type CaseListItem } from "@/lib/data/casos"
import { queryKeys } from "@/lib/queries/keys"

/**
 * Listado de casos cacheado para los 3 componentes (`/`, `/casos`, vista
 * animada). Comparten la misma queryKey, así que un solo round-trip por
 * staleTime — la 2da navegación al listado es instantánea.
 */
export function useCasesList() {
  return useQuery<CaseListItem[]>({
    queryKey: queryKeys.casesList,
    queryFn: () => fetchCasesList(createClient()),
  })
}
