"use client"

import { useMemo } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"
import type { PaginatedResponse } from "@/lib/schemas/pagination"
import type { ClientDTO } from "@/hooks/use-clients"
import type { ProjectDTO } from "@/hooks/use-projects"
import type { TaskDTO } from "@/hooks/use-tasks"
import type { InvoiceWireRow } from "@/domain/billing/types"

/**
 * Number of rows requested per entity. The endpoints over-fetch one extra row
 * to compute `hasMore`, so the palette can tell the user when its list is a
 * truncated view of a larger match set.
 */
export const SEARCH_LIMIT = 6

export interface InvoiceSearchRow extends InvoiceWireRow {
  clientName: string
}

interface EntityHits<T> {
  rows: T[]
  hasMore: boolean
}

export interface EntitySearchResults {
  clients: EntityHits<ClientDTO>
  projects: EntityHits<ProjectDTO>
  tasks: EntityHits<TaskDTO>
  invoices: EntityHits<InvoiceSearchRow>
  isPending: boolean
}

const EMPTY_ROWS: never[] = []

function useResourceSearch<T>(
  resource: string,
  path: string,
  term: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: qk.search(resource, term),
    queryFn: () =>
      api.get<PaginatedResponse<T>>(
        `${path}?q=${encodeURIComponent(term)}&limit=${SEARCH_LIMIT}`,
      ),
    enabled: enabled && term.length > 0,
    staleTime: STALE_TIME.list,
    placeholderData: keepPreviousData,
  })
}

function toHits<T>(page: PaginatedResponse<T> | undefined): EntityHits<T> {
  if (!page) return { rows: EMPTY_ROWS, hasMore: false }
  return { rows: page.data, hasMore: page.hasMore }
}

/**
 * Server-side entity search backing the command palette.
 *
 * Each resource is queried through its list endpoint's `?q=` filter, so
 * matches are found across the whole (user-scoped) table instead of the first
 * cached page. Results are capped at {@link SEARCH_LIMIT} per entity and the
 * endpoint's `hasMore` flag is surfaced so the caller can warn about
 * truncation.
 *
 * @param term - The debounced, trimmed search term. Empty disables every query.
 * @param enabled - Gates the network entirely; pass `true` only while the
 * palette is open.
 * @returns Per-entity rows, their truncation flags and a combined pending flag.
 */
export function useEntitySearch(
  term: string,
  enabled: boolean,
): EntitySearchResults {
  const clients = useResourceSearch<ClientDTO>(
    "clients",
    "/api/clients",
    term,
    enabled,
  )
  const projects = useResourceSearch<ProjectDTO>(
    "projects",
    "/api/projects",
    term,
    enabled,
  )
  const tasks = useResourceSearch<TaskDTO>("tasks", "/api/tasks", term, enabled)
  const invoices = useResourceSearch<InvoiceSearchRow>(
    "invoices",
    "/api/invoices",
    term,
    enabled,
  )

  const active = enabled && term.length > 0
  const isPending =
    active &&
    (clients.isPending ||
      projects.isPending ||
      tasks.isPending ||
      invoices.isPending)

  return useMemo(
    () => ({
      clients: toHits(clients.data),
      projects: toHits(projects.data),
      tasks: toHits(tasks.data),
      invoices: toHits(invoices.data),
      isPending,
    }),
    [clients.data, projects.data, tasks.data, invoices.data, isPending],
  )
}
