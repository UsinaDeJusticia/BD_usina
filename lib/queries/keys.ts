// Query keys centralizadas — referenciables desde mutation sites para invalidar.

export const queryKeys = {
  casesList: ["cases", "list"] as const,
  dashboardStats: ["dashboard", "stats"] as const,
  notificationsAll: ["notifications"] as const,
  notifications: ["notifications", "list"] as const,
  notificationsUnread: ["notifications", "unread"] as const,
  notificationPrefs: ["notifications", "prefs"] as const,
} as const
