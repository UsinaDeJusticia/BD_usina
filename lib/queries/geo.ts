"use client"

import { useQuery } from "@tanstack/react-query"
import type { FeatureCollection, Geometry } from "geojson"
import { queryKeys } from "@/lib/queries/keys"

export interface ProvinciaProperties {
  provincia: string
  indec: string
  source_name?: string
}

export type ProvinciasGeoJSON = FeatureCollection<Geometry, ProvinciaProperties>

async function fetchProvinciasGeo(): Promise<ProvinciasGeoJSON> {
  const response = await fetch("/geo/provincias-ar.geojson")
  if (!response.ok) throw new Error(`No se pudo cargar el mapa (${response.status})`)
  return (await response.json()) as ProvinciasGeoJSON
}

/** Límites de provincias. Son estáticos, así que no se revalidan. */
export function useProvinciasGeo() {
  return useQuery<ProvinciasGeoJSON>({
    queryKey: queryKeys.provinciasGeo,
    queryFn: fetchProvinciasGeo,
    staleTime: Number.POSITIVE_INFINITY,
  })
}
