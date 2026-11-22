"use client"

import { useEffect, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { queryKeys } from "@/lib/queries/keys"
import { borrarNotificacion, fetchNotificaciones, marcarLeida, marcarTodasLeidas, type Notificacion } from "./api"

/**
 * Lista de notificaciones del usuario. Se refresca cada minuto, al volver a la
 * pestaña y cuando llega un push (el service worker avisa con postMessage).
 */
export function useNotificaciones() {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => fetchNotificaciones(supabase),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    // Si 016 todavía no está aplicado, la tabla no existe: no reintentar en loop.
    retry: false,
  })

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "notificacion-recibida") {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
      }
    }
    navigator.serviceWorker.addEventListener("message", onMessage)
    return () => navigator.serviceWorker.removeEventListener("message", onMessage)
  }, [queryClient])

  const setLocal = (fn: (list: Notificacion[]) => Notificacion[]) =>
    queryClient.setQueryData<Notificacion[]>(queryKeys.notifications, (old) => fn(old ?? []))
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
  const now = () => new Date().toISOString()

  const markRead = useMutation({
    mutationFn: (id: string) => marcarLeida(supabase, id),
    onMutate: (id) => setLocal((l) => l.map((n) => (n.id === id && !n.leida_at ? { ...n, leida_at: now() } : n))),
    onError: refresh,
  })
  const markAllRead = useMutation({
    mutationFn: () => marcarTodasLeidas(supabase),
    onMutate: () => setLocal((l) => l.map((n) => (n.leida_at ? n : { ...n, leida_at: now() }))),
    onError: refresh,
  })
  const remove = useMutation({
    mutationFn: (id: string) => borrarNotificacion(supabase, id),
    onMutate: (id) => setLocal((l) => l.filter((n) => n.id !== id)),
    onError: refresh,
  })

  const items = query.data ?? []
  const unread = items.filter((n) => !n.leida_at).length

  return { query, items, unread, markRead, markAllRead, remove, refresh }
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
