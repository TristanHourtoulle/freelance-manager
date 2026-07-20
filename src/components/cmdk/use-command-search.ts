"use client"

import { useEffect, useMemo, useState } from "react"
import type { useRouter } from "next/navigation"
import { useClients } from "@/hooks/use-clients"
import { useInvoices } from "@/hooks/use-invoices"
import { useTasks } from "@/hooks/use-tasks"
import { fmtEUR } from "@/lib/format"
import type { CommandItem } from "@/components/cmdk/command-palette"

type Router = ReturnType<typeof useRouter>

const DEBOUNCE_MS = 150
const MAX_PER_GROUP = 6

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

/**
 * Builds dynamic {@link CommandItem} results for the command palette by
 * searching cached clients, invoices and tasks against the typed query.
 *
 * Reuses the existing TanStack Query hooks ({@link useClients},
 * {@link useInvoices}, {@link useTasks}) so results come from the shared
 * cache with no extra network cost. Filtering is client-side and debounced;
 * an empty query yields no entity results, leaving the static nav/actions.
 *
 * @param query - The live palette input value.
 * @param router - The Next.js router used to navigate to a matched entity.
 * @param enabled - Gates the three entity queries. Pass `true` only while the
 * palette is open so closed (and mobile) sessions fetch nothing.
 * @returns Grouped command items ("Clients", "Factures", "Tasks").
 */
export function useCommandSearch(
  query: string,
  router: Router,
  enabled = true,
): CommandItem[] {
  const debounced = useDebouncedValue(query.trim().toLowerCase(), DEBOUNCE_MS)

  const { data: clients } = useClients({ enabled })
  const { data: invoices } = useInvoices({ enabled })
  const { data: tasks } = useTasks(undefined, { enabled })

  return useMemo<CommandItem[]>(() => {
    if (!debounced) return []

    const clientResults: CommandItem[] = (clients ?? [])
      .filter((c) => {
        const hay =
          `${c.firstName} ${c.lastName} ${c.company ?? ""} ${c.email ?? ""}`.toLowerCase()
        return hay.includes(debounced)
      })
      .slice(0, MAX_PER_GROUP)
      .map((c) => {
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

    const invoiceResults: CommandItem[] = (invoices ?? [])
      .filter((inv) => inv.number.toLowerCase().includes(debounced))
      .slice(0, MAX_PER_GROUP)
      .map((inv) => ({
        id: `invoice-${inv.id}`,
        group: "Factures",
        label: `Facture ${inv.number}`,
        hint: fmtEUR(inv.total),
        icon: "invoice",
        keywords: [inv.number, "facture", "invoice"],
        run: () => router.push(`/billing?invoiceId=${inv.id}`),
      }))

    const taskResults: CommandItem[] = (tasks ?? [])
      .filter((t) => {
        const hay = `${t.linearIdentifier} ${t.title}`.toLowerCase()
        return hay.includes(debounced)
      })
      .slice(0, MAX_PER_GROUP)
      .map((t) => ({
        id: `task-${t.id}`,
        group: "Tasks",
        label: `[${t.linearIdentifier}] ${t.title}`,
        icon: "check-square",
        keywords: [t.linearIdentifier, "task", "linear"],
        run: () => router.push(`/tasks?clientId=${t.clientId}`),
      }))

    return [...clientResults, ...invoiceResults, ...taskResults]
  }, [debounced, clients, invoices, tasks, router])
}
