// Query keys centralizadas — referenciables desde mutation sites para invalidar.

export const queryKeys = {
  casesList: ["cases", "list"] as const,
  dashboardStats: ["dashboard", "stats"] as const,
  candidatosPendientes: ["candidatos", "pendientes"] as const,
  candidatoDetail: (id: string) => ["candidatos", "detail", id] as const,
} as const
