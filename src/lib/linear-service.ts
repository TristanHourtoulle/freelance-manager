import { linearClient } from "@/lib/linear"
import { TTLCache } from "@/lib/cache"
import { env } from "@/lib/env"

export interface LinearTeamDTO {
  id: string
  name: string
  key: string
  description: string | undefined
  color: string | undefined
  icon: string | undefined
}

export interface LinearProjectDTO {
  id: string
  name: string
  description: string
  state: string
  progress: number
  startDate: string | undefined
  targetDate: string | undefined
  color: string
  icon: string | undefined
}

export interface LinearIssueStatusDTO {
  id: string
  name: string
  type: string
  color: string
}

export interface LinearIssueAssigneeDTO {
  id: string
  name: string
  email: string | undefined
}

export interface LinearIssueLabelDTO {
  id: string
  name: string
  color: string
}

export interface LinearIssueDTO {
  id: string
  identifier: string
  title: string
  estimate: number | undefined
  completedAt: string | undefined
  createdAt: string
  url: string
  priority: number
  priorityLabel: string
  status: LinearIssueStatusDTO | undefined
  assignee: LinearIssueAssigneeDTO | undefined
  labels: LinearIssueLabelDTO[]
  projectId: string | undefined
  teamId: string | undefined
}

const BASE_TTL_MS = (env.LINEAR_CACHE_TTL_SECONDS ?? 300) * 1000
const TEAMS_TTL = BASE_TTL_MS * 2
const PROJECTS_TTL = BASE_TTL_MS
const ISSUES_TTL = Math.max(Math.round(BASE_TTL_MS * 0.4), 60_000)

const teamsCache = new TTLCache<LinearTeamDTO[]>(TEAMS_TTL)
const projectsCache = new TTLCache<LinearProjectDTO[]>(PROJECTS_TTL)
const issuesCache = new TTLCache<LinearIssueDTO[]>(ISSUES_TTL)

let lastSyncedAt: number | null = null
let lastWebhookReceivedAt: number | null = null

export function setLastWebhookReceivedAt(timestamp: number): void {
  lastWebhookReceivedAt = timestamp
}

export async function updateLinearIssueEstimate(
  issueId: string,
  estimate: number,
): Promise<void> {
  await linearClient.updateIssue(issueId, { estimate })
  issuesCache.clear()
}

export async function createLinearIssue(input: {
  title: string
  description?: string
  estimate?: number
  teamId: string
  projectId: string
}): Promise<LinearIssueDTO> {
  const payload = await linearClient.createIssue({
    teamId: input.teamId,
    title: input.title,
    description: input.description,
    estimate: input.estimate,
    projectId: input.projectId,
  })

  const issue = await payload.issue

  if (!issue) {
    throw new Error("Linear API returned no issue after creation")
  }

  const state = await issue.state
  const assignee = await issue.assignee
  const labels = await issue.labels()
  const project = await issue.project
  const team = await issue.team

  issuesCache.clear()

  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    estimate: issue.estimate ?? undefined,
    completedAt: issue.completedAt?.toISOString() ?? undefined,
    createdAt: issue.createdAt.toISOString(),
    url: issue.url,
    priority: issue.priority,
    priorityLabel: issue.priorityLabel,
    status: state
      ? {
          id: state.id,
          name: state.name,
          type: state.type,
          color: state.color,
        }
      : undefined,
    assignee: assignee
      ? {
          id: assignee.id,
          name: assignee.name,
          email: assignee.email ?? undefined,
        }
      : undefined,
    labels: labels.nodes.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
    })),
    projectId: project?.id ?? undefined,
    teamId: team?.id ?? undefined,
  }
}

export function clearLinearCaches(): void {
  teamsCache.clear()
  projectsCache.clear()
  issuesCache.clear()
}

export function getLinearSyncStatus(): {
  lastSyncedAt: number | null
  lastWebhookReceivedAt: number | null
  isStale: boolean
} {
  const isStale =
    lastSyncedAt === null || Date.now() - lastSyncedAt > BASE_TTL_MS
  return { lastSyncedAt, lastWebhookReceivedAt, isStale }
}

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
  lastSyncedAt = Date.now()
  return result
}

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
  lastSyncedAt = Date.now()
  return result
}

interface RawIssueResponse {
  issues: {
    nodes: Array<{
      id: string
      identifier: string
      title: string
      estimate: number | null
      completedAt: string | null
      createdAt: string
      url: string
      priority: number
      priorityLabel: string
      state: {
        id: string
        name: string
        type: string
        color: string
      } | null
      assignee: {
        id: string
        name: string
        email: string | null
      } | null
      labels: {
        nodes: Array<{
          id: string
          name: string
          color: string
        }>
      }
      project: { id: string } | null
      team: { id: string } | null
    }>
  }
}

export async function fetchLinearIssues(filters: {
  teamId?: string
  projectId?: string
}): Promise<LinearIssueDTO[]> {
  const cacheKey = `${filters.teamId ?? ""}:${filters.projectId ?? ""}`
  const cached = issuesCache.get(cacheKey)
  if (cached) return cached

  const filterParts: string[] = []
  if (filters.teamId) {
    filterParts.push(`team: { id: { eq: "${filters.teamId}" } }`)
  }
  if (filters.projectId) {
    filterParts.push(`project: { id: { eq: "${filters.projectId}" } }`)
  }
  const filterClause =
    filterParts.length > 0 ? `filter: { ${filterParts.join(", ")} },` : ""

  const query = `
    query FetchIssues {
      issues(${filterClause} first: 100, orderBy: updatedAt) {
        nodes {
          id
          identifier
          title
          estimate
          completedAt
          createdAt
          url
          priority
          priorityLabel
          state {
            id
            name
            type
            color
          }
          assignee {
            id
            name
            email
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
          project {
            id
          }
          team {
            id
          }
        }
      }
    }
  `

  const response = await linearClient.client.rawRequest<
    RawIssueResponse,
    Record<string, unknown>
  >(query)

  if (!response.data) {
    throw new Error("Linear API returned no data")
  }

  const result: LinearIssueDTO[] = response.data.issues.nodes.map((node) => ({
    id: node.id,
    identifier: node.identifier,
    title: node.title,
    estimate: node.estimate ?? undefined,
    completedAt: node.completedAt ?? undefined,
    createdAt: node.createdAt,
    url: node.url,
    priority: node.priority,
    priorityLabel: node.priorityLabel,
    status: node.state
      ? {
          id: node.state.id,
          name: node.state.name,
          type: node.state.type,
          color: node.state.color,
        }
      : undefined,
    assignee: node.assignee
      ? {
          id: node.assignee.id,
          name: node.assignee.name,
          email: node.assignee.email ?? undefined,
        }
      : undefined,
    labels: node.labels.nodes.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
    })),
    projectId: node.project?.id ?? undefined,
    teamId: node.team?.id ?? undefined,
  }))

  issuesCache.set(cacheKey, result)
  lastSyncedAt = Date.now()
  return result
}
