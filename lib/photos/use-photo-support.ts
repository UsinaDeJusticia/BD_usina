"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

/**
 * Clasifica el resultado de consultar victimas.foto_path:
 * - sin error → la columna existe;
 * - error de columna inexistente (42703 / menciona foto_path) → no existe (scripts/017 sin aplicar);
 * - cualquier otro error (red, 5xx, caché de esquema) → se relanza para reintentar.
 */
export function classifyPhotoSupport(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) return true
  if (error.code === "42703" || /foto_path/i.test(error.message ?? "")) return false
  throw error
}

const RECHECK_WHEN_MISSING_MS = 5 * 60 * 1000

/**
 * ¿La base ya tiene victimas.foto_path (scripts/017)? Mientras no, el selector
 * de foto se oculta para no ofrecer algo que no se puede guardar.
 *
 * Usa GET con limit 0 (no HEAD): una respuesta HEAD no trae el código de error
 * y no se podría distinguir "columna inexistente" de un error pasajero.
 * Los errores pasajeros se reintentan; un "no existe" se vuelve a comprobar
 * cada 5 minutos (p.ej. si se aplica 017 con la app abierta).
 */
export function useVictimPhotoSupport() {
  const supabase = useMemo(() => createClient(), [])
  const q = useQuery({
    queryKey: ["victim-photo-support"],
    queryFn: async () => {
      const { error } = await supabase.from("victimas").select("foto_path").limit(0)
      return classifyPhotoSupport(error)
    },
    staleTime: (query) => (query.state.data === true ? Infinity : RECHECK_WHEN_MISSING_MS),
    refetchInterval: (query) => (query.state.data === true ? false : RECHECK_WHEN_MISSING_MS),
    retry: 3,
  })
  return q.data === true
}
