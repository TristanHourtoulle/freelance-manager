import { linearClient } from "@/lib/linear"
import type { LinearIssueDTO, LinearIssueDetailDTO } from "./linear-types"
import { issuesCache, markSynced } from "./linear-cache"

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
  markSynced()
  return result
}
