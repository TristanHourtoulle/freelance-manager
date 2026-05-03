import "server-only"
import { cacheLife, cacheTag } from "next/cache"
import { getLinearClient } from "@/lib/linear"

export interface LinearTeam {
  id: string
  key: string
  name: string
}

export interface LinearProject {
  id: string
  name: string
  description: string | null
}

/**
 * Cache tag helpers — exported so mutation routes can call `updateTag()`
 * with the exact same tag the read functions register.
 */
export const linearTeamsTag = (userId: string) => `user-${userId}-linear-teams`
export const linearProjectsTag = (userId: string) =>
  `user-${userId}-linear-projects`

/**
 * Cached Linear teams for the current user. Workspace metadata is slow-
 * changing — we cache for the `'hours'` profile and invalidate via
 * {@link linearTeamsTag} from the token PUT/DELETE and the sync route.
 */
export async function getLinearTeams(userId: string): Promise<LinearTeam[]> {
  "use cache"
  cacheLife("hours")
  cacheTag(linearTeamsTag(userId))

  const ul = await getLinearClient(userId)
  if (!ul) return []
  const teams = await ul.client.teams({ first: 100 })
  return teams.nodes.map((t) => ({ id: t.id, key: t.key, name: t.name }))
}

/**
 * Cached Linear projects for the current user, optionally scoped to a
 * Linear team. Same `'hours'` profile and invalidation strategy as
 * {@link getLinearTeams}.
 */
export async function getLinearProjects(
  userId: string,
  teamId?: string,
): Promise<LinearProject[]> {
  "use cache"
  cacheLife("hours")
  cacheTag(linearProjectsTag(userId))

  const ul = await getLinearClient(userId)
  if (!ul) return []
  if (teamId) {
    const team = await ul.client.team(teamId)
    if (!team) return []
    const projects = await team.projects({ first: 100 })
    return projects.nodes.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? null,
    }))
  }
  const projects = await ul.client.projects({ first: 100 })
  return projects.nodes.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? null,
  }))
}
