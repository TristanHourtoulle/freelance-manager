import type { QueryClient } from "@tanstack/react-query"

/**
 * Typed query-key factory for every TanStack Query resource used across the
 * hooks.
 *
 * Each accessor returns a readonly tuple whose runtime value is byte-identical
 * to the inline arrays it replaces, so cache identity and prefix-based
 * invalidation are unchanged. Resources that are both queried with an argument
 * and invalidated by prefix expose two forms: `list`/`detail` for the exact
 * key and `all` for the prefix.
 */
export const qk = {
  dashboard: () => ["dashboard"] as const,
  settings: () => ["settings"] as const,
  analytics: <R>(range: R) => ["analytics", range] as const,
  analyticsAll: () => ["analytics"] as const,

  clients: () => ["clients"] as const,
  client: {
    all: () => ["client"] as const,
    detail: (id: string | null | undefined) => ["client", id] as const,
    activity: (id: string | null | undefined) =>
      ["client-activity", id] as const,
  },

  invoices: () => ["invoices"] as const,
  invoice: (id: string | null | undefined) => ["invoice", id] as const,

  quotes: <F>(filters?: F) =>
    (filters === undefined ? ["quotes"] : ["quotes", filters]) as
      | readonly ["quotes"]
      | readonly ["quotes", F],
  quotesAll: () => ["quotes"] as const,
  quote: (id: string | null | undefined) => ["quote", id] as const,

  projects: () => ["projects"] as const,

  search: (resource: string, term: string) =>
    ["search", resource, term] as const,

  tasks: {
    all: () => ["tasks"] as const,
    list: <F>(filters: F) => ["tasks", filters] as const,
  },
  actions: {
    all: () => ["actions"] as const,
    list: <F>(filters: F) => ["actions", filters] as const,
  },
  meetings: {
    all: () => ["meetings"] as const,
    list: <F>(filters: F) => ["meetings", filters] as const,
  },

  linear: {
    mappings: () => ["linear-mappings"] as const,
    projects: () => ["linear-projects"] as const,
    syncStatus: () => ["linear-sync-status"] as const,
    clientMappings: {
      all: () => ["client-linear-mappings"] as const,
      detail: (clientId: string | null | undefined) =>
        ["client-linear-mappings", clientId] as const,
    },
  },
} as const

/**
 * Shared `staleTime` tiers (in ms) for TanStack Query.
 *
 * Named constants replace the per-hook magic numbers. Values match the
 * previous inline literals exactly, so no caching behavior changes.
 *
 * @remarks
 * - `list`: fast-moving collections and per-client sub-lists refetched often
 *   (tasks, actions, meetings, client activity, Linear mappings) — 30s.
 * - `detail`: single-entity views and aggregates (client/invoice detail,
 *   dashboard, analytics, settings) — 60s.
 * - `longLived`: near-static data — 5min.
 * - `hour`: large, rarely-mutated collections kept warm for a full hour
 *   (clients, invoices, projects, Linear projects) — 60min.
 */
export const STALE_TIME = {
  list: 30_000,
  detail: 60_000,
  longLived: 5 * 60_000,
  hour: 60 * 60_000,
} as const

/**
 * Invalidates the recurring invoice graph: the invoice list, one invoice
 * detail and the dashboard aggregate.
 *
 * @param qc - The active query client.
 * @param invoiceId - The invoice whose detail cache should be invalidated.
 */
export function invalidateInvoiceGraph(qc: QueryClient, invoiceId: string) {
  qc.invalidateQueries({ queryKey: qk.invoices() })
  qc.invalidateQueries({ queryKey: qk.invoice(invoiceId) })
  qc.invalidateQueries({ queryKey: qk.dashboard() })
}
