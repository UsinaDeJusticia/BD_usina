"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/queries/keys"
import type { DecidirCandidatoInput, PropuestaCandidata } from "@/lib/mdd/types"

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body?.error || `Error ${res.status} en ${url}`)
  }
  return body as T
}

/** Cola de propuestas pendientes de Mapa del Delito, para `/candidatos`. */
export function useCandidatosPendientes() {
  return useQuery<PropuestaCandidata[]>({
    queryKey: queryKeys.candidatosPendientes,
    queryFn: async () => {
      const { data } = await fetchJson<{ data: PropuestaCandidata[] }>("/api/candidatos")
      return data
    },
  })
}

/** Detalle de un candidato puntual, usado por el pre-fill de `/casos/nuevo`. */
export function useCandidatoDetail(id: string | undefined) {
  return useQuery<PropuestaCandidata | null>({
    queryKey: queryKeys.candidatoDetail(id ?? ""),
    queryFn: async () => {
      const { data } = await fetchJson<{ data: PropuestaCandidata }>(`/api/candidatos/${id}`)
      return data
    },
    enabled: !!id,
  })
}

/**
 * Aprobar/rechazar/marcar duplicado. Para "aprobada" normalmente no se usa
 * este hook directo — el flujo real es navegar a `/casos/nuevo?fromCandidato=id`
 * y disparar la decisión recién cuando la ficha se guardó con éxito (ver
 * components/cases/case-form.tsx). Este hook cubre "rechazada" y
 * "duplicada", que se resuelven sin salir de `/candidatos`.
 */
export function useDecidirCandidato() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: DecidirCandidatoInput & { id: string }) => {
      return fetchJson<{ ok: true; callbackOk: boolean }>(`/api/candidatos/${id}/decidir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.candidatosPendientes })
    },
  })
}
