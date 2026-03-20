import { TTLCache } from "@/lib/cache"

/** In-memory TTL cache for dashboard KPI responses (5 minutes per user). */
export const dashboardCache = new TTLCache<Record<string, unknown>>(
  5 * 60 * 1000,
)
