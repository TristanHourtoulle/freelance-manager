"use client"

import { useEffect, useMemo, useState } from "react"
import type { useRouter } from "next/navigation"
import { SEARCH_LIMIT, useEntitySearch } from "@/hooks/use-entity-search"
import { fmtEUR } from "@/lib/format"
import type { CommandItem } from "@/components/cmdk/command-palette"

type Router = ReturnType<typeof useRouter>

const DEBOUNCE_MS = 150

/**
 * Debounces a rapidly-changing string, emitting the latest value only after
 * `delay` ms of quiet. Keeps the entity search from firing on every keystroke.
 *
 * @param value - The live input value.
 * @param delay - Quiet period in milliseconds before the value settles.
 * @returns The debounced value.
 */
function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

function truncationNotice(
  id: string,
  group: string,
  router: Router,
  href: string,
): CommandItem {
  return {
    id: `${id}-truncated`,
    group,
    sticky: true,
    label: `Seuls les ${SEARCH_LIMIT} premiers résultats sont affichés`,
    hint: "Affine ta recherche ou ouvre la liste complète",
    icon: "search",
    run: () => router.push(href),
  }
}

/**
 * Builds dynamic {@link CommandItem} results for the command palette by
 * searching clients, projects, invoices and tasks server-side.
 *
 * Search runs through each list endpoint's `?q=` filter (see
 * {@link useEntitySearch}) rather than filtering an already-fetched page, so
 * entities outside the first page are reachable. Queries are debounced and
 * gated; an empty query yields no entity results, leaving the static
 * nav/actions. When an entity has more matches than the palette shows, a
 * sticky notice is appended to its group instead of hiding the overflow.
 *
 * @param query - The live palette input value.
 * @param router - The Next.js router used to navigate to a matched entity.
 * @param enabled - Gates the entity queries. Pass `true` only while the
 * palette is open so closed (and mobile) sessions fetch nothing.
 * @returns Grouped command items ("Clients", "Projets", "Factures", "Tasks").
 */
export function useCommandSearch(
  query: string,
  router: Router,
  enabled = true,
): CommandItem[] {
  const debounced = useDebouncedValue(query.trim(), DEBOUNCE_MS)
  const { clients, projects, tasks, invoices } = useEntitySearch(
    debounced,
    enabled,
  )

  return useMemo<CommandItem[]>(() => {
    if (!debounced) return []

    const clientResults: CommandItem[] = clients.rows.map((c) => {
      const name = `${c.firstName} ${c.lastName}`.trim()
      return {
        id: `client-${c.id}`,
        group: "Clients",
        label: name || (c.company ?? "Client"),
        hint: c.company ?? c.email ?? undefined,
        icon: "user",
        keywords: [c.company ?? "", c.email ?? "", "client"].filter(Boolean),
        run: () => router.push(`/clients/${c.id}`),
      }
    })
    if (clients.hasMore) {
      clientResults.push(
        truncationNotice("clients", "Clients", router, "/clients"),
      )
    }

    const projectResults: CommandItem[] = projects.rows.map((p) => ({
      id: `project-${p.id}`,
      group: "Projets",
      label: p.name,
      hint: p.client.company ?? `${p.client.firstName} ${p.client.lastName}`,
      icon: "folder",
      keywords: [p.key, "projet", "project", "linear"],
      run: () => router.push(`/tasks?projectId=${p.id}`),
    }))
    if (projects.hasMore) {
      projectResults.push(
        truncationNotice("projects", "Projets", router, "/projects"),
      )
    }

    const invoiceResults: CommandItem[] = invoices.rows.map((inv) => ({
      id: `invoice-${inv.id}`,
      group: "Factures",
      label: `Facture ${inv.number}`,
      hint: `${inv.clientName} · ${fmtEUR(inv.total)}`,
      icon: "invoice",
      keywords: [inv.number, inv.clientName, "facture", "invoice"],
      run: () => router.push(`/billing?invoiceId=${inv.id}`),
    }))
    if (invoices.hasMore) {
      invoiceResults.push(
        truncationNotice("invoices", "Factures", router, "/billing"),
      )
    }

    const taskResults: CommandItem[] = tasks.rows.map((t) => ({
      id: `task-${t.id}`,
      group: "Tasks",
      label: `[${t.linearIdentifier}] ${t.title}`,
      icon: "check-square",
      keywords: [t.linearIdentifier, "task", "linear"],
      run: () => router.push(`/tasks?clientId=${t.clientId}`),
    }))
    if (tasks.hasMore) {
      taskResults.push(truncationNotice("tasks", "Tasks", router, "/tasks"))
    }

    return [
      ...clientResults,
      ...projectResults,
      ...invoiceResults,
      ...taskResults,
    ]
  }, [debounced, clients, projects, invoices, tasks, router])
}
