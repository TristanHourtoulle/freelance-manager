import "server-only"
import { LinearClient } from "@linear/sdk"
import { prisma } from "@/lib/db"
import { decrypt, encrypt } from "@/lib/encryption"
import type { TaskStatus, TaskPriority } from "@/generated/prisma/client"

interface UserLinear {
  client: LinearClient
}

/** Resolve a Linear SDK client for the current user, or null if no token. */
export async function getLinearClient(
  userId: string,
): Promise<UserLinear | null> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      linearApiTokenEncrypted: true,
      linearApiTokenIv: true,
      linearApiTokenKeyVersion: true,
    },
  })

  if (!settings?.linearApiTokenEncrypted || !settings.linearApiTokenIv) {
    return null
  }
  const apiKey = decrypt(
    Buffer.from(settings.linearApiTokenEncrypted),
    Buffer.from(settings.linearApiTokenIv),
    settings.linearApiTokenKeyVersion ?? 1,
  )
  return { client: new LinearClient({ apiKey }) }
}

/** Persist (or rotate) the user's encrypted Linear API token. */
export async function setLinearToken(
  userId: string,
  token: string,
): Promise<void> {
  const { ciphertext, iv, keyVersion } = encrypt(token)
  const ct = new Uint8Array(ciphertext)
  const ivBytes = new Uint8Array(iv)
  await prisma.userSettings.upsert({
    where: { userId },
    update: {
      linearApiTokenEncrypted: ct,
      linearApiTokenIv: ivBytes,
      linearApiTokenKeyVersion: keyVersion,
    },
    create: {
      userId,
      linearApiTokenEncrypted: ct,
      linearApiTokenIv: ivBytes,
      linearApiTokenKeyVersion: keyVersion,
    },
  })
}

export async function clearLinearToken(userId: string): Promise<void> {
  await prisma.userSettings.update({
    where: { userId },
    data: {
      linearApiTokenEncrypted: null,
      linearApiTokenIv: null,
      linearApiTokenKeyVersion: null,
    },
  })
}

/**
 * Map a Linear issue state's `type` field to our normalized TaskStatus enum.
 * Linear types: backlog | unstarted | started | completed | canceled | triage.
 */
export function mapLinearStateType(
  type: string | null | undefined,
  hasInvoice: boolean,
): TaskStatus {
  switch (type) {
    case "started":
      return "IN_PROGRESS"
    case "completed":
      return hasInvoice ? "DONE" : "PENDING_INVOICE"
    case "canceled":
      return "CANCELED"
    case "backlog":
    case "unstarted":
    case "triage":
    default:
      return "BACKLOG"
  }
}

/**
 * Map Linear's numeric priority (0=none, 1=urgent, 2=high, 3=medium, 4=low)
 * to our enum.
 */
export function mapLinearPriority(p: number | null | undefined): TaskPriority {
  switch (p) {
    case 1:
      return "URGENT"
    case 2:
      return "HIGH"
    case 3:
      return "MEDIUM"
    case 4:
      return "LOW"
    case 0:
    default:
      return "NONE"
  }
}

/** Compute Project.key from Linear identifier prefix (e.g. "TRI-543" → "TRI"). */
export function keyFromIdentifier(identifier: string): string {
  const idx = identifier.indexOf("-")
  return idx > 0 ? identifier.slice(0, idx) : identifier
}

interface SyncResult {
  projects: number
  tasks: number
}

function projectStatus(
  state: string | undefined | null,
): "COMPLETED" | "PAUSED" | "ACTIVE" {
  if (state === "completed") return "COMPLETED"
  if (state === "paused") return "PAUSED"
  return "ACTIVE"
}

type IssueSyncFilter =
  | { project: { id: { eq: string } } }
  | { team: { id: { eq: string } } }

interface IssuesQueryVariables extends Record<string, unknown> {
  filter: IssueSyncFilter
  first: number
}

interface RawIssueState {
  name: string | null
  type: string | null
}

interface RawIssueTeam {
  id: string
  key: string | null
}

interface RawIssueProject {
  id: string
  name: string
  description: string | null
  state: string | null
  createdAt: string | null
}

interface RawIssueNode {
  id: string
  identifier: string
  title: string
  description: string | null
  priority: number | null
  estimate: number | null
  completedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  state: RawIssueState | null
  team: RawIssueTeam | null
  project: RawIssueProject | null
}

interface IssuesQueryData {
  issues: { nodes: RawIssueNode[] }
}

interface EnrichedIssue {
  issue: {
    id: string
    identifier: string
    title: string
    description: string | null
    priority: number | null
    estimate: number | null
    completedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }
  project: {
    id: string
    name: string
    description: string | null
    state: string | null
    createdAt: Date | null
  } | null
  team: { id: string; key: string | null } | null
  state: { name: string | null; type: string | null } | null
}

const ISSUES_SYNC_QUERY = `
  query SyncIssues($filter: IssueFilter, $first: Int) {
    issues(filter: $filter, first: $first) {
      nodes {
        id
        identifier
        title
        description
        priority
        estimate
        completedAt
        createdAt
        updatedAt
        state { name type }
        team { id key }
        project { id name description state createdAt }
      }
    }
  }
`

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null
}

/** Normalize a raw GraphQL issue node into the shape the write phase consumes. */
export function normalizeIssueNode(node: RawIssueNode): EnrichedIssue {
  return {
    issue: {
      id: node.id,
      identifier: node.identifier,
      title: node.title,
      description: node.description ?? null,
      priority: node.priority ?? null,
      estimate: node.estimate ?? null,
      completedAt: toDate(node.completedAt),
      createdAt: toDate(node.createdAt),
      updatedAt: toDate(node.updatedAt),
    },
    project: node.project
      ? {
          id: node.project.id,
          name: node.project.name,
          description: node.project.description ?? null,
          state: node.project.state ?? null,
          createdAt: toDate(node.project.createdAt),
        }
      : null,
    team: node.team ? { id: node.team.id, key: node.team.key ?? null } : null,
    state: node.state
      ? { name: node.state.name ?? null, type: node.state.type ?? null }
      : null,
  }
}

/**
 * Fetch up to 250 issues matching `filter` with `project`, `team` and `state`
 * resolved inline in a single GraphQL request (instead of one lazy relation
 * fetch per issue, which was the sync N+1).
 *
 * @param client Linear SDK client whose raw GraphQL transport is used.
 * @param filter Scope filter (`project.id.eq` or `team.id.eq`).
 * @returns Normalized issues ready for the DB write phase.
 */
export async function fetchIssuesWithRelations(
  client: LinearClient,
  filter: IssueSyncFilter,
): Promise<EnrichedIssue[]> {
  const response = await client.client.rawRequest<
    IssuesQueryData,
    IssuesQueryVariables
  >(ISSUES_SYNC_QUERY, { filter, first: 250 })
  const nodes = response.data?.issues?.nodes ?? []
  return nodes.map(normalizeIssueNode)
}

/**
 * Pull all issues from the Linear scopes mapped to the user's clients and
 * upsert local Project/Task rows. This is the "Sync Linear" button's handler.
 *
 * The function is split into two phases to keep the database transaction
 * short and never wait on Linear API I/O while holding row locks:
 *
 *   PHASE 1 — pull (no DB): for every mapping, fetch the issues page with
 *     `project`, `team`, `state` resolved inline in a single GraphQL request
 *     (one query per mapping, not 1 + 3N). Builds an in-memory list of
 *     `enriched` records.
 *
 *   PHASE 2 — write (single transaction): one batched findMany to learn
 *     which tasks already exist (so we can preserve invoiceId), then
 *     project + task upserts inside `prisma.$transaction(...)`. The
 *     userSettings.linearLastSyncedAt write is in the same tx so the
 *     sync timestamp can never drift from the data.
 *
 * If phase 1 throws (Linear API error), no DB write happens; if phase 2
 * throws, everything rolls back.
 */
export async function syncFromLinear(userId: string): Promise<SyncResult> {
  const userLinear = await getLinearClient(userId)
  if (!userLinear) {
    throw new Error("No Linear token configured for this user")
  }
  const { client } = userLinear

  const mappings = await prisma.linearMapping.findMany({
    where: { client: { userId } },
    include: { client: true },
  })

  const enrichedByMapping: {
    mapping: (typeof mappings)[number]
    issues: EnrichedIssue[]
  }[] = []
  for (const m of mappings) {
    if (!m.linearProjectId && !m.linearTeamId) {
      enrichedByMapping.push({ mapping: m, issues: [] })
      continue
    }
    const filter: IssueSyncFilter = m.linearProjectId
      ? { project: { id: { eq: m.linearProjectId } } }
      : { team: { id: { eq: m.linearTeamId! } } }
    const enriched = await fetchIssuesWithRelations(client, filter)
    enrichedByMapping.push({ mapping: m, issues: enriched })
  }

  const allIssueIds = enrichedByMapping.flatMap((g) =>
    g.issues.map((e) => e.issue.id),
  )

  // Phase 2 — write: single transaction, no Linear I/O inside.
  let projectsUpserted = 0
  let tasksUpserted = 0

  await prisma.$transaction(async (tx) => {
    const existingTasks =
      allIssueIds.length > 0
        ? await tx.task.findMany({
            where: { userId, linearIssueId: { in: allIssueIds } },
            select: { linearIssueId: true, invoiceId: true },
          })
        : []
    const invoiceByIssueId = new Map(
      existingTasks.map((t) => [t.linearIssueId, t.invoiceId]),
    )

    const localProjectIdByLinearId = new Map<string, string>()

    for (const group of enrichedByMapping) {
      const { mapping, issues } = group
      for (const { issue, project, team, state } of issues) {
        if (!project) continue

        let localProjectId = localProjectIdByLinearId.get(project.id)
        if (!localProjectId) {
          const localProject = await tx.project.upsert({
            where: { linearProjectId: project.id },
            create: {
              userId,
              clientId: mapping.clientId,
              linearProjectId: project.id,
              linearTeamId: team?.id ?? null,
              name: project.name,
              key: team?.key ?? keyFromIdentifier(issue.identifier),
              description: project.description ?? null,
              status: projectStatus(project.state),
              linearCreatedAt: project.createdAt ?? null,
            },
            update: {
              name: project.name,
              description: project.description ?? null,
              status: projectStatus(project.state),
              linearTeamId: team?.id ?? null,
              lastSyncedAt: new Date(),
            },
          })
          localProjectId = localProject.id
          localProjectIdByLinearId.set(project.id, localProjectId)
          projectsUpserted++
        }

        const status = mapLinearStateType(
          state?.type,
          Boolean(invoiceByIssueId.get(issue.id)),
        )

        await tx.task.upsert({
          where: { linearIssueId: issue.id },
          create: {
            userId,
            clientId: mapping.clientId,
            projectId: localProjectId,
            linearIssueId: issue.id,
            linearIdentifier: issue.identifier,
            linearStateName: state?.name ?? null,
            linearStateType: state?.type ?? null,
            title: issue.title,
            description: issue.description ?? null,
            status,
            priority: mapLinearPriority(issue.priority),
            estimate: issue.estimate ?? null,
            completedAt: issue.completedAt ?? null,
            linearCreatedAt: issue.createdAt ?? null,
            linearUpdatedAt: issue.updatedAt ?? null,
          },
          update: {
            clientId: mapping.clientId,
            projectId: localProjectId,
            linearIdentifier: issue.identifier,
            linearStateName: state?.name ?? null,
            linearStateType: state?.type ?? null,
            title: issue.title,
            description: issue.description ?? null,
            status,
            priority: mapLinearPriority(issue.priority),
            estimate: issue.estimate ?? null,
            completedAt: issue.completedAt ?? null,
            linearUpdatedAt: issue.updatedAt ?? null,
            lastSyncedAt: new Date(),
          },
        })
        tasksUpserted++
      }
    }

    await tx.userSettings.upsert({
      where: { userId },
      update: { linearLastSyncedAt: new Date() },
      create: { userId, linearLastSyncedAt: new Date() },
    })
  })

  return { projects: projectsUpserted, tasks: tasksUpserted }
}

/**
 * Pull a single Linear project (and its issues) into the local DB. Used right
 * after the user links a project so the row is visible immediately, without
 * waiting for a full sync.
 */
export async function syncOneProject(opts: {
  userId: string
  clientId: string
  linearProjectId: string
}): Promise<void> {
  const userLinear = await getLinearClient(opts.userId)
  if (!userLinear) {
    throw new Error("No Linear token configured for this user")
  }
  const { client } = userLinear

  const linearProject = await client.project(opts.linearProjectId)
  if (!linearProject) throw new Error("Linear project not found")

  const localProject = await prisma.project.upsert({
    where: { linearProjectId: linearProject.id },
    create: {
      userId: opts.userId,
      clientId: opts.clientId,
      linearProjectId: linearProject.id,
      name: linearProject.name,
      key: linearProject.name.slice(0, 4).toUpperCase(),
      description: linearProject.description ?? null,
      status:
        linearProject.state === "completed"
          ? "COMPLETED"
          : linearProject.state === "paused"
            ? "PAUSED"
            : "ACTIVE",
      linearCreatedAt: linearProject.createdAt ?? null,
    },
    update: {
      clientId: opts.clientId,
      name: linearProject.name,
      description: linearProject.description ?? null,
      status:
        linearProject.state === "completed"
          ? "COMPLETED"
          : linearProject.state === "paused"
            ? "PAUSED"
            : "ACTIVE",
      lastSyncedAt: new Date(),
    },
  })

  const enriched = await fetchIssuesWithRelations(client, {
    project: { id: { eq: linearProject.id } },
  })

  const issueIds = enriched.map((e) => e.issue.id)
  const existingTasks = await prisma.task.findMany({
    where: { linearIssueId: { in: issueIds } },
    select: { linearIssueId: true, invoiceId: true },
  })

  const invoiceByIssueId = new Map(
    existingTasks.map((t) => [t.linearIssueId, t.invoiceId]),
  )

  const firstTeam = enriched.find((e) => e.team)?.team
  if (firstTeam?.key) {
    await prisma.project.update({
      where: { id: localProject.id },
      data: { key: firstTeam.key, linearTeamId: firstTeam.id },
    })
  }

  await Promise.all(
    enriched.map(({ issue, state }) => {
      const status = mapLinearStateType(
        state?.type,
        Boolean(invoiceByIssueId.get(issue.id)),
      )
      return prisma.task.upsert({
        where: { linearIssueId: issue.id },
        create: {
          userId: opts.userId,
          clientId: opts.clientId,
          projectId: localProject.id,
          linearIssueId: issue.id,
          linearIdentifier: issue.identifier,
          linearStateName: state?.name ?? null,
          linearStateType: state?.type ?? null,
          title: issue.title,
          description: issue.description ?? null,
          status,
          priority: mapLinearPriority(issue.priority),
          estimate: issue.estimate ?? null,
          completedAt: issue.completedAt ?? null,
          linearCreatedAt: issue.createdAt ?? null,
          linearUpdatedAt: issue.updatedAt ?? null,
        },
        update: {
          clientId: opts.clientId,
          projectId: localProject.id,
          linearIdentifier: issue.identifier,
          linearStateName: state?.name ?? null,
          linearStateType: state?.type ?? null,
          title: issue.title,
          description: issue.description ?? null,
          status,
          priority: mapLinearPriority(issue.priority),
          estimate: issue.estimate ?? null,
          completedAt: issue.completedAt ?? null,
          linearUpdatedAt: issue.updatedAt ?? null,
          lastSyncedAt: new Date(),
        },
      })
    }),
  )

  await prisma.userSettings.upsert({
    where: { userId: opts.userId },
    update: { linearLastSyncedAt: new Date() },
    create: { userId: opts.userId, linearLastSyncedAt: new Date() },
  })
}

/** List Linear teams for the linking dropdown. */
export async function listLinearTeams(userId: string) {
  const ul = await getLinearClient(userId)
  if (!ul) return []
  const teams = await ul.client.teams({ first: 100 })
  return teams.nodes.map((t) => ({ id: t.id, key: t.key, name: t.name }))
}

/** List Linear projects (optionally scoped to a team) for the linking dropdown. */
export async function listLinearProjects(userId: string, teamId?: string) {
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
