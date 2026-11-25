"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { signPhotoUrls } from "./storage"
import { isProfilePhotoPath } from "./utils"

/**
 * Devuelve { ruta → URL firmada } para las fotos pedidas, con UN request por
 * lote. Los links duran 1 h; se renuevan a los 50 min. Si falla (p.ej. sin
 * red), las tarjetas muestran las iniciales.
 */
export function usePhotoUrls(paths: (string | null | undefined)[]) {
  const supabase = useMemo(() => createClient(), [])
  const valid = useMemo(() => Array.from(new Set(paths.filter(isProfilePhotoPath))).sort(), [paths])

  const query = useQuery({
    queryKey: ["photo-urls", valid],
    queryFn: () => signPhotoUrls(supabase, valid),
    enabled: valid.length > 0,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
    refetchInterval: 50 * 60 * 1000,
    retry: 1,
  })

  return query.data ?? {}
}
