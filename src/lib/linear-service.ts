import { linearClient } from "@/lib/linear"
import { TTLCache } from "@/lib/cache"
import { env } from "@/lib/env"

/** Normalized representation of a Linear team. */
export interface LinearTeamDTO {
  id: string
  name: string
  key: string
  description: string | undefined
  color: string | undefined
  icon: string | undefined
}

/** Normalized representation of a Linear project. */
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

/** Normalized representation of a Linear issue workflow status. */
export interface LinearIssueStatusDTO {
  id: string
  name: string
  type: string
  color: string
}

/** Normalized representation of a Linear issue assignee. */
export interface LinearIssueAssigneeDTO {
  id: string
  name: string
  email: string | undefined
}

/** Normalized representation of a Linear issue label. */
export interface LinearIssueLabelDTO {
  id: string
  name: string
  color: string
}

/** Normalized representation of a Linear issue with status, assignee, and labels. */
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
  projectName: string | undefined
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

/**
 * Records the timestamp of the most recent Linear webhook event.
 *
 * @param timestamp - Unix timestamp in milliseconds
 */
export function setLastWebhookReceivedAt(timestamp: number): void {
  lastWebhookReceivedAt = timestamp
}

/**
 * Updates an issue's workflow status in Linear and clears the local issues cache.
 *
 * @param issueId - Linear issue ID
 * @param stateId - New workflow state ID
 */
export async function updateLinearIssueStatus(
  issueId: string,
  stateId: string,
): Promise<void> {
  await linearClient.updateIssue(issueId, { stateId })
  issuesCache.clear()
}

/**
 * Updates an issue's estimate in Linear and clears the local issues cache.
 *
 * @param issueId - Linear issue ID
 * @param estimate - New estimate value (in story points / hours)
 */
export async function updateLinearIssueEstimate(
  issueId: string,
  estimate: number,
): Promise<void> {
  await linearClient.updateIssue(issueId, { estimate })
  issuesCache.clear()
}

/**
 * Creates a new issue in Linear and returns the normalized DTO.
 * Clears the issues cache after creation.
 *
 * @param input - Issue creation parameters (title, description, estimate, teamId, projectId)
 * @returns The newly created issue as a LinearIssueDTO
 * @throws Error if Linear API returns no issue after creation
 */
export async function createLinearIssue(input: {
  title: string
  description?: string
  estimate?: number
  teamId: string
  projectId: string
  assigneeId?: string
  stateId?: string
  labelIds?: string[]
}): Promise<LinearIssueDTO> {
  const payload = await linearClient.createIssue({
    teamId: input.teamId,
    title: input.title,
    description: input.description,
    estimate: input.estimate,
    projectId: input.projectId,
    assigneeId: input.assigneeId,
    stateId: input.stateId,
    labelIds: input.labelIds,
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
    projectName: project?.name ?? undefined,
    teamId: team?.id ?? undefined,
  }
}

/** Clears all in-memory Linear caches (teams, projects, issues). */
export function clearLinearCaches(): void {
  teamsCache.clear()
  projectsCache.clear()
  issuesCache.clear()
  membersCache.clear()
  statesCache.clear()
  labelsCache.clear()
}

/**
 * Returns the current Linear sync status including staleness detection.
 *
 * @returns Object with lastSyncedAt timestamp, lastWebhookReceivedAt timestamp, and isStale flag
 */
export function getLinearSyncStatus(): {
  lastSyncedAt: number | null
  lastWebhookReceivedAt: number | null
  isStale: boolean
} {
  const isStale =
    lastSyncedAt === null || Date.now() - lastSyncedAt > BASE_TTL_MS
  return { lastSyncedAt, lastWebhookReceivedAt, isStale }
}

/** Extended issue DTO with description, dates, and project name for the detail view. */
export interface LinearIssueDetailDTO extends LinearIssueDTO {
  description: string | undefined
  updatedAt: string
  dueDate: string | undefined
  projectName: string | undefined
}

interface RawIssueDetailResponse {
  issue: {
    id: string
    identifier: string
    title: string
    description: string | null
    estimate: number | null
    completedAt: string | null
    createdAt: string
    updatedAt: string
    dueDate: string | null
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
    project: { id: string; name: string } | null
    team: { id: string } | null
  }
}

/**
 * Fetches a single Linear issue by ID using a GraphQL query.
 * Returns the full detail DTO including description and project name.
 *
 * @param issueId - Linear issue ID
 * @returns The issue detail DTO
 * @throws Error if the Linear API returns no data
 */
export async function fetchLinearIssueById(
  issueId: string,
): Promise<LinearIssueDetailDTO> {
  const query = `
    query FetchIssue($id: String!) {
      issue(id: $id) {
        id
        identifier
        title
        description
        estimate
        completedAt
        createdAt
        updatedAt
        dueDate
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
          name
        }
        team {
          id
        }
      }
    }
  `

  const response = await linearClient.client.rawRequest<
    RawIssueDetailResponse,
    { id: string }
  >(query, { id: issueId })

  if (!response.data) {
    throw new Error("Linear API returned no data")
  }

  const node = response.data.issue

  return {
    id: node.id,
    identifier: node.identifier,
    title: node.title,
    description: node.description ?? undefined,
    estimate: node.estimate ?? undefined,
    completedAt: node.completedAt ?? undefined,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    dueDate: node.dueDate ?? undefined,
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
    projectName: node.project?.name ?? undefined,
    teamId: node.team?.id ?? undefined,
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
  lastSyncedAt = Date.now()
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
  lastSyncedAt = Date.now()
  return result
}

/** Normalized team member for assignment. */
export interface LinearMemberDTO {
  id: string
  name: string
  email: string | undefined
}

/** Normalized workflow state for status selection. */
export interface LinearWorkflowStateDTO {
  id: string
  name: string
  type: string
  color: string
}

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

const membersCache = new TTLCache<LinearMemberDTO[]>(TEAMS_TTL)
const statesCache = new TTLCache<LinearWorkflowStateDTO[]>(TEAMS_TTL)
const labelsCache = new TTLCache<LinearIssueLabelDTO[]>(TEAMS_TTL)

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

/** Lightweight issue representation returned by search queries. */
export interface LinearIssueSearchResult {
  id: string
  identifier: string
  title: string
  url: string
}

interface RawIssueSearchResponse {
  issueSearch: {
    nodes: Array<{
      id: string
      identifier: string
      title: string
      url: string
    }>
  }
}

/**
 * Searches Linear issues by text query using a GraphQL search.
 * Returns up to 5 matching results.
 *
 * @param query - Free-text search query
 * @returns Array of lightweight search results
 */
export async function searchLinearIssues(
  query: string,
): Promise<LinearIssueSearchResult[]> {
  const gql = `
    query SearchIssues($query: String!) {
      issueSearch(query: $query, first: 5) {
        nodes {
          id
          identifier
          title
          url
        }
      }
    }
  `

  const response = await linearClient.client.rawRequest<
    RawIssueSearchResponse,
    { query: string }
  >(gql, { query })

  if (!response.data) {
    return []
  }

  return response.data.issueSearch.nodes.map((node) => ({
    id: node.id,
    identifier: node.identifier,
    title: node.title,
    url: node.url,
  }))
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
      project: { id: string; name: string } | null
      team: { id: string } | null
    }>
  }
}

/**
 * Fetches Linear issues with TTL caching, optionally filtered by team and/or project.
 *
 * @param filters - Optional teamId and/or projectId to filter issues
 * @returns Array of normalized issue DTOs
 * @throws Error if the Linear API returns no data
 */
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
            name
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
    projectName: node.project?.name ?? undefined,
    teamId: node.team?.id ?? undefined,
  }))

  issuesCache.set(cacheKey, result)
  lastSyncedAt = Date.now()
  return result
}
