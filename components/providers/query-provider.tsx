"use client"

// Provider de TanStack Query para toda la app.
//
// Defaults pensados para una BD chica que cambia poco:
//   staleTime: 5 min   -> navegar ida y vuelta no re-fetchea
//   gcTime:    10 min  -> data fuera de pantalla queda en RAM
//   refetchOnWindowFocus: false -> no traer todo de nuevo al volver al tab
//
// Las invalidaciones explícitas (cuando se crea/edita/elimina un caso)
// están en los mutation sites de `case-form.tsx` y `case-detail-content.tsx`.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"

export function QueryProvider({ children }: { children: ReactNode }) {
  // useState garantiza una sola instancia por mount (no reasignar en re-render).
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
