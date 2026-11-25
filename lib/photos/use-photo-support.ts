"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

/**
 * ¿La base ya tiene victimas.foto_path (scripts/017)? Mientras no, el selector
 * de foto se oculta para no ofrecer algo que no se puede guardar. Una sola
 * consulta liviana (HEAD, sin filas) por sesión.
 */
export function useVictimPhotoSupport() {
  const supabase = useMemo(() => createClient(), [])
  const q = useQuery({
    queryKey: ["victim-photo-support"],
    queryFn: async () => {
      const { error } = await supabase.from("victimas").select("foto_path", { head: true }).limit(1)
      return !error
    },
    staleTime: Infinity,
    retry: false,
  })
  return q.data === true
}
