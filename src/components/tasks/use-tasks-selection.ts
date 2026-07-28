"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * The client/project multi-select narrowing of the Tasks page.
 */
export interface TasksSelection {
  clientIds: string[]
  projectIds: string[]
}

/**
 * The minimal project shape needed to prune impossible selections.
 */
export interface ProjectClientLink {
  id: string
  clientId: string
}

interface SearchParamsReader {
  get(name: string): string | null
}

/**
 * Reads an id list from the URL, merging the comma-separated plural param
 * with the legacy singular one so old deep links keep working.
 *
 * @param search - The current search params.
 * @param pluralKey - The comma-separated list param (e.g. `clientIds`).
 * @param singularKey - The legacy single-value param (e.g. `clientId`).
 * @returns The deduped ids, plural values first.
 */
export function parseIdListParam(
  search: SearchParamsReader,
  pluralKey: string,
  singularKey: string,
): string[] {
  const values = (search.get(pluralKey) ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
  const legacy = search.get(singularKey)
  if (legacy) values.push(legacy)
  return [...new Set(values)]
}

/**
 * Drops selected projects that belong to a client outside the selected set,
 * so the client filter and the project filter can never contradict each
 * other. Projects missing from `projects` (not loaded yet) are kept.
 *
 * @param projectIds - The candidate project selection.
 * @param clientIds - The selected clients; empty means every client.
 * @param projects - The known project → client links.
 * @returns The pruned project selection.
 */
export function pruneProjectIds(
  projectIds: readonly string[],
  clientIds: readonly string[],
  projects: readonly ProjectClientLink[],
): string[] {
  if (clientIds.length === 0) return [...projectIds]
  const clientByProject = new Map(projects.map((p) => [p.id, p.clientId]))
  return projectIds.filter((id) => {
    const owner = clientByProject.get(id)
    return owner === undefined || clientIds.includes(owner)
  })
}

/**
 * URL-backed client/project selection for the Tasks page.
 *
 * The selection lives entirely in the query string (`?clientIds=a,b` /
 * `?projectIds=x,y`) so a filtered view is shareable and survives reload.
 * Legacy `?clientId=` / `?projectId=` deep links (command palette, old
 * bookmarks) are still read. Writes go through `router.replace` with
 * `scroll: false`: filtering never pushes history entries nor jumps the page,
 * and always rewrites the legacy params into the plural form.
 *
 * @param projects - The known projects, used to prune selected projects whose
 * client leaves the selection.
 * @returns The current `clientIds` / `projectIds` plus a `setSelection`
 * writer.
 */
export function useTasksSelection(projects: readonly ProjectClientLink[]) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()

  const clientIds = useMemo(
    () => parseIdListParam(search, "clientIds", "clientId"),
    [search],
  )
  const projectIds = useMemo(
    () => parseIdListParam(search, "projectIds", "projectId"),
    [search],
  )

  const setSelection = useCallback(
    (next: TasksSelection) => {
      const prunedProjectIds = pruneProjectIds(
        next.projectIds,
        next.clientIds,
        projects,
      )
      const params = new URLSearchParams(search.toString())
      params.delete("clientId")
      params.delete("clientIds")
      params.delete("projectId")
      params.delete("projectIds")
      if (next.clientIds.length > 0)
        params.set("clientIds", next.clientIds.join(","))
      if (prunedProjectIds.length > 0)
        params.set("projectIds", prunedProjectIds.join(","))
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, search, projects],
  )

  return { clientIds, projectIds, setSelection }
}
