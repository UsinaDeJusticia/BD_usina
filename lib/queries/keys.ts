// Query keys centralizadas — referenciables desde mutation sites para invalidar.

export const queryKeys = {
  casesList: ["cases", "list"] as const,
  dashboardStats: ["dashboard", "stats"] as const,
  provinciasGeo: ["geo", "provincias-ar"] as const,
} as const
