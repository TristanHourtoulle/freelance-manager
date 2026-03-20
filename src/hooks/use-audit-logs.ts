"use client"

import { useQuery, keepPreviousData } from "@tanstack/react-query"

interface AuditLogEntry {
  id: string
  userId: string
  action: string
  entity: string
  entityId: string | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface AuditLogsResponse {
  items: AuditLogEntry[]
  pagination: Pagination
}

export type { AuditLogEntry, AuditLogsResponse }

/**
 * Fetches paginated audit logs with optional filters.
 */
export function useAuditLogs(searchParams: string) {
  return useQuery<AuditLogsResponse>({
    queryKey: ["audit-logs", searchParams],
    queryFn: async () => {
      const res = await fetch(`/api/audit-logs?${searchParams}`)
      if (!res.ok) throw new Error("Failed to fetch audit logs")
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
}
