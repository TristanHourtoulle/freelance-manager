"use client"

import { useMemo } from "react"
import { Icon } from "@/components/ui/icon"
import { SegmentedControl } from "@/components/ui/segmented-control"
import {
  FilterCombobox,
  type FilterComboboxGroup,
  type FilterComboboxOption,
} from "@/components/ui/filter-combobox"
import type { ClientDTO } from "@/hooks/use-clients"
import type { ProjectDTO } from "@/hooks/use-projects"
import type { TaskCountsSummary } from "@/hooks/use-tasks"
import type { TasksSelection } from "@/components/tasks/use-tasks-selection"

/**
 * The status chips of the Tasks page filter bar.
 */
export type StatusFilterId =
  | "all"
  | "pending"
  | "done"
  | "in_progress"
  | "non_billable"

/**
 * The status the Tasks page opens on: ready-to-bill tasks.
 */
export const DEFAULT_STATUS_FILTER: StatusFilterId = "pending"

const CLIENTS_GROUP_ID = "clients"

/**
 * Props of the Tasks page filter bar.
 */
export interface TasksFilterBarProps {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  statusFilter: StatusFilterId
  onStatusFilterChange: (value: StatusFilterId) => void
  counts: TaskCountsSummary | undefined
  clients: readonly ClientDTO[]
  projects: readonly ProjectDTO[]
  clientIds: readonly string[]
  projectIds: readonly string[]
  onSelectionChange: (selection: TasksSelection) => void
}

function clientLabel(client: ClientDTO): string {
  return client.company ?? `${client.firstName} ${client.lastName}`
}

/**
 * The Tasks page filter row: free-text search, status segmented control and
 * one client/project multi-select {@link FilterCombobox}.
 *
 * Inside the combobox, clients form the first section and projects are
 * grouped under their client. When clients are selected, project options
 * narrow to those clients' projects, so an impossible client × project
 * combination cannot be built. The combobox emits one flat id array; this
 * component partitions it back into `clientIds` / `projectIds`, keeping ids
 * that are not in the loaded lists in their previous bucket so URL-driven
 * selections survive a partially loaded page.
 *
 * @param props - Controlled search / status / selection state plus the
 * clients, projects and server counts feeding the controls.
 * @returns The filter row.
 */
export function TasksFilterBar({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  counts,
  clients,
  projects,
  clientIds,
  projectIds,
  onSelectionChange,
}: TasksFilterBarProps) {
  const visibleProjects = useMemo(
    () =>
      clientIds.length === 0
        ? [...projects]
        : projects.filter((p) => clientIds.includes(p.clientId)),
    [projects, clientIds],
  )

  const groups = useMemo<FilterComboboxGroup[]>(() => {
    const result: FilterComboboxGroup[] = [
      { id: CLIENTS_GROUP_ID, label: "Clients" },
    ]
    const seen = new Set<string>()
    const clientById = new Map(clients.map((c) => [c.id, c]))
    for (const p of visibleProjects) {
      if (seen.has(p.clientId)) continue
      seen.add(p.clientId)
      const owner = clientById.get(p.clientId)
      result.push({
        id: `projects-${p.clientId}`,
        label: `Projets · ${owner ? clientLabel(owner) : (p.client.company ?? `${p.client.firstName} ${p.client.lastName}`)}`,
      })
    }
    return result
  }, [clients, visibleProjects])

  const options = useMemo<FilterComboboxOption[]>(
    () => [
      ...clients.map((c) => ({
        id: c.id,
        label: clientLabel(c),
        groupId: CLIENTS_GROUP_ID,
      })),
      ...visibleProjects.map((p) => ({
        id: p.id,
        label: p.name,
        groupId: `projects-${p.clientId}`,
        hint: p.key,
      })),
    ],
    [clients, visibleProjects],
  )

  function handleComboboxChange(ids: string[]) {
    const clientIdSet = new Set(clients.map((c) => c.id))
    const projectIdSet = new Set(projects.map((p) => p.id))
    const nextClients: string[] = []
    const nextProjects: string[] = []
    for (const id of ids) {
      if (clientIdSet.has(id)) nextClients.push(id)
      else if (projectIdSet.has(id)) nextProjects.push(id)
      else if (clientIds.includes(id)) nextClients.push(id)
      else if (projectIds.includes(id)) nextProjects.push(id)
    }
    onSelectionChange({ clientIds: nextClients, projectIds: nextProjects })
  }

  return (
    <div
      className="row gap-12"
      style={{
        marginBottom: 14,
        justifyContent: "space-between",
        flexWrap: "wrap",
      }}
    >
      <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
        <Icon
          name="search"
          size={14}
          className="muted"
          style={{ position: "absolute", left: 12, top: 10 }}
        />
        <input
          className="input"
          style={{ paddingLeft: 34 }}
          placeholder="Rechercher par ID ou titre…"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
        />
      </div>
      <div className="row gap-12" style={{ flexWrap: "wrap" }}>
        <SegmentedControl<StatusFilterId>
          options={[
            { id: "all", label: "Tout", count: counts?.all },
            { id: "pending", label: "À facturer", count: counts?.pending },
            { id: "done", label: "Done", count: counts?.done },
            {
              id: "in_progress",
              label: "In progress",
              count: counts?.in_progress,
            },
            {
              id: "non_billable",
              label: "Non facturable",
              count: counts?.non_billable,
            },
          ]}
          value={statusFilter}
          onChange={onStatusFilterChange}
          label="Filtrer par statut"
        />
        <FilterCombobox
          label="Filtres"
          options={options}
          groups={groups}
          selected={[...clientIds, ...projectIds]}
          onChange={handleComboboxChange}
          placeholder="Rechercher un client ou un projet…"
          emptyLabel="Aucun résultat"
        />
      </div>
    </div>
  )
}
