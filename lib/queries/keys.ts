// Query keys centralizadas — referenciables desde mutation sites para invalidar.

export const queryKeys = {
  casesList: ["cases", "list"] as const,
  dashboardStats: ["dashboard", "stats"] as const,
  notifications: ["notifications", "list"] as const,
  notificationPrefs: ["notifications", "prefs"] as const,
} as const
