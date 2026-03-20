import { linearClient } from "@/lib/linear"
import type {
  LinearTeamDTO,
  LinearProjectDTO,
  LinearMemberDTO,
  LinearWorkflowStateDTO,
  LinearIssueLabelDTO,
} from "./linear-types"
import {
  teamsCache,
  projectsCache,
  membersCache,
  statesCache,
  labelsCache,
  markSynced,
} from "./linear-cache"

interface RawTeamMembersResponse {
  team: {
    members: {
      nodes: Array<{
        id: string
        name: string
        email: string | null
        active: boolean
      }>
    }
  }
}

interface RawWorkflowStatesResponse {
  team: {
    states: {
      nodes: Array<{
        id: string
        name: string
        type: string
        color: string
      }>
    }
  }
}

interface RawTeamLabelsResponse {
  team: {
    labels: {
      nodes: Array<{
        id: string
        name: string
        color: string
      }>
    }
  }
}

/**
 * Fetches all Linear teams with TTL caching.
 *
 * @returns Array of normalized team DTOs
 */
export async function fetchLinearTeams(): Promise<LinearTeamDTO[]> {
  const cached = teamsCache.get("all")
  if (cached) return cached

  const teams = await linearClient.teams({ first: 50 })

  const result: LinearTeamDTO[] = teams.nodes.map((team) => ({
    id: team.id,
    name: team.name,
    key: team.key,
    description: team.description ?? undefined,
    color: team.color ?? undefined,
    icon: team.icon ?? undefined,
  }))

  teamsCache.set("all", result)
  markSynced()
  return result
}

/**
 * Fetches Linear projects with TTL caching, optionally filtered by team.
 *
 * @param teamId - Optional team ID to filter projects
 * @returns Array of normalized project DTOs
 */
export async function fetchLinearProjects(
  teamId?: string,
): Promise<LinearProjectDTO[]> {
  const cacheKey = teamId ?? "all"
  const cached = projectsCache.get(cacheKey)
  if (cached) return cached

  const projects = teamId
    ? await (await linearClient.team(teamId)).projects({ first: 100 })
    : await linearClient.projects({ first: 100 })

  const result: LinearProjectDTO[] = projects.nodes.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    state: project.state,
    progress: project.progress,
    startDate: project.startDate ?? undefined,
    targetDate: project.targetDate ?? undefined,
    color: project.color,
    icon: project.icon ?? undefined,
  }))

  projectsCache.set(cacheKey, result)
  markSynced()
  return result
}

/**
 * Fetches active members of a Linear team.
 *
 * @param teamId - Linear team ID
 * @returns Array of team members
 */
export async function fetchLinearTeamMembers(
  teamId: string,
): Promise<LinearMemberDTO[]> {
  const cached = membersCache.get(teamId)
  if (cached) return cached

  const query = `
    query TeamMembers($teamId: String!) {
      team(id: $teamId) {
        members(first: 100) {
          nodes {
            id
            name
            email
            active
          }
        }
      }
    }
  `

  const response = await linearClient.client.rawRequest<
    RawTeamMembersResponse,
    { teamId: string }
  >(query, { teamId })

  if (!response.data) return []

  const result = response.data.team.members.nodes
    .filter((m) => m.active)
    .map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email ?? undefined,
    }))

  membersCache.set(teamId, result)
  return result
}

/**
 * Fetches workflow states for a Linear team.
 *
 * @param teamId - Linear team ID
 * @returns Array of workflow states
 */
export async function fetchLinearWorkflowStates(
  teamId: string,
): Promise<LinearWorkflowStateDTO[]> {
  const cached = statesCache.get(teamId)
  if (cached) return cached

  const query = `
    query TeamStates($teamId: String!) {
      team(id: $teamId) {
        states(first: 50) {
          nodes {
            id
            name
            type
            color
          }
        }
      }
    }
  `

  const response = await linearClient.client.rawRequest<
    RawWorkflowStatesResponse,
    { teamId: string }
  >(query, { teamId })

  if (!response.data) return []

  const result = response.data.team.states.nodes.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    color: s.color,
  }))

  statesCache.set(teamId, result)
  return result
}

/**
 * Fetches labels for a Linear team.
 *
 * @param teamId - Linear team ID
 * @returns Array of team labels
 */
export async function fetchLinearTeamLabels(
  teamId: string,
): Promise<LinearIssueLabelDTO[]> {
  const cached = labelsCache.get(teamId)
  if (cached) return cached

  const query = `
    query TeamLabels($teamId: String!) {
      team(id: $teamId) {
        labels(first: 100) {
          nodes {
            id
            name
            color
          }
        }
      }
    }
  `

  const response = await linearClient.client.rawRequest<
    RawTeamLabelsResponse,
    { teamId: string }
  >(query, { teamId })

  if (!response.data) return []

  const result = response.data.team.labels.nodes.map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color,
  }))

  labelsCache.set(teamId, result)
  return result
}
