"use client"

import { useEffect, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { queryKeys } from "@/lib/queries/keys"
import {
  borrarNotificacion,
  contarNoLeidas,
  fetchNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
  PAGE_SIZE,
  type Notificacion,
} from "./api"

/**
 * Notificaciones del usuario. `limit` define cuántas se cargan (la página usa
 * "Cargar más"); el contador de no leídas sale de una consulta aparte, así que
 * es exacto aunque haya más notificaciones que las cargadas.
 * Se refresca cada minuto, al volver a la pestaña y cuando llega un push.
 */
export function useNotificaciones({ limit = PAGE_SIZE }: { limit?: number } = {}) {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  const common = {
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    // Si 016 todavía no está aplicado, la tabla no existe: no reintentar en loop.
    retry: false,
  } as const

  const listKey = [...queryKeys.notifications, limit] as const
  const query = useQuery({
    queryKey: listKey,
    queryFn: () => fetchNotificaciones(supabase, limit),
    // Al "Cargar más" se muestran las ya cargadas mientras llegan las nuevas.
    placeholderData: (prev) => prev,
    ...common,
  })
  const unreadQuery = useQuery({ queryKey: queryKeys.notificationsUnread, queryFn: () => contarNoLeidas(supabase), ...common })

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationsUnread }),
    ])

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "notificacion-recibida") {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
        queryClient.invalidateQueries({ queryKey: queryKeys.notificationsUnread })
      }
    }
    navigator.serviceWorker.addEventListener("message", onMessage)
    return () => navigator.serviceWorker.removeEventListener("message", onMessage)
  }, [queryClient])

  // Actualizaciones optimistas sobre TODAS las listas cargadas (campanita y página).
  const setLists = (fn: (list: Notificacion[]) => Notificacion[]) =>
    queryClient.setQueriesData<Notificacion[]>({ queryKey: queryKeys.notifications }, (old) => (old ? fn(old) : old))
  const setUnread = (fn: (n: number) => number) =>
    queryClient.setQueryData<number>(queryKeys.notificationsUnread, (old) => Math.max(0, fn(old ?? 0)))
  const isUnread = (id: string) =>
    queryClient
      .getQueriesData<Notificacion[]>({ queryKey: queryKeys.notifications })
      .some(([, list]) => list?.some((n) => n.id === id && !n.leida_at))
  const now = () => new Date().toISOString()

  const markRead = useMutation({
    mutationFn: (id: string) => marcarLeida(supabase, id),
    onMutate: (id) => {
      if (isUnread(id)) setUnread((n) => n - 1)
      setLists((l) => l.map((n) => (n.id === id && !n.leida_at ? { ...n, leida_at: now() } : n)))
    },
    onError: refresh,
  })
  const markAllRead = useMutation({
    mutationFn: () => marcarTodasLeidas(supabase),
    onMutate: () => {
      setUnread(() => 0)
      setLists((l) => l.map((n) => (n.leida_at ? n : { ...n, leida_at: now() })))
    },
    onError: refresh,
  })
  const remove = useMutation({
    mutationFn: (id: string) => borrarNotificacion(supabase, id),
    onMutate: (id) => {
      if (isUnread(id)) setUnread((n) => n - 1)
      setLists((l) => l.filter((n) => n.id !== id))
    },
    onError: refresh,
  })

  const items = query.data ?? []
  const unread = unreadQuery.data ?? items.filter((n) => !n.leida_at).length
  const hasMore = items.length >= limit

  return { query, items, unread, hasMore, markRead, markAllRead, remove, refresh }
}

export function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return "recién"
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 7) return `hace ${d} d`
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}
