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
    select: { linearApiTokenEncrypted: true, linearApiTokenIv: true },
  })

  if (!settings?.linearApiTokenEncrypted || !settings.linearApiTokenIv) {
    return null
  }
  const apiKey = decrypt(
    Buffer.from(settings.linearApiTokenEncrypted),
    Buffer.from(settings.linearApiTokenIv),
  )
  return { client: new LinearClient({ apiKey }) }
}

/** Persist (or rotate) the user's encrypted Linear API token. */
export async function setLinearToken(
  userId: string,
  token: string,
): Promise<void> {
  const { ciphertext, iv } = encrypt(token)
  const ct = new Uint8Array(ciphertext)
  const ivBytes = new Uint8Array(iv)
  await prisma.userSettings.upsert({
    where: { userId },
    update: { linearApiTokenEncrypted: ct, linearApiTokenIv: ivBytes },
    create: {
      userId,
      linearApiTokenEncrypted: ct,
      linearApiTokenIv: ivBytes,
    },
  })
}

export async function clearLinearToken(userId: string): Promise<void> {
  await prisma.userSettings.update({
    where: { userId },
    data: { linearApiTokenEncrypted: null, linearApiTokenIv: null },
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

/**
 * Pull all issues from the Linear scopes mapped to the user's clients and
 * upsert local Project/Task rows. This is the "Sync Linear" button's handler.
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

  let projectsUpserted = 0
  let tasksUpserted = 0

  for (const m of mappings) {
    const filter: Record<string, unknown> = {}
    if (m.linearProjectId) {
      filter.project = { id: { eq: m.linearProjectId } }
    } else if (m.linearTeamId) {
      filter.team = { id: { eq: m.linearTeamId } }
    } else {
      continue
    }

    const issues = await client.issues({
      filter: filter as never,
      first: 250,
    })

    for (const issue of issues.nodes) {
      const project = await issue.project
      if (!project) continue

      const team = await issue.team
      const state = await issue.state

      const localProject = await prisma.project.upsert({
        where: { linearProjectId: project.id },
        create: {
          userId,
          clientId: m.clientId,
          linearProjectId: project.id,
          linearTeamId: team?.id ?? null,
          name: project.name,
          key: team?.key ?? keyFromIdentifier(issue.identifier),
          description: project.description ?? null,
          status:
            project.state === "completed"
              ? "COMPLETED"
              : project.state === "paused"
                ? "PAUSED"
                : "ACTIVE",
          linearCreatedAt: project.createdAt ?? null,
        },
        update: {
          name: project.name,
          description: project.description ?? null,
          status:
            project.state === "completed"
              ? "COMPLETED"
              : project.state === "paused"
                ? "PAUSED"
                : "ACTIVE",
          linearTeamId: team?.id ?? null,
          lastSyncedAt: new Date(),
        },
      })
      projectsUpserted++

      const existing = await prisma.task.findUnique({
        where: { linearIssueId: issue.id },
        select: { invoiceId: true },
      })

      const status = mapLinearStateType(
        state?.type,
        Boolean(existing?.invoiceId),
      )

      await prisma.task.upsert({
        where: { linearIssueId: issue.id },
        create: {
          userId,
          clientId: m.clientId,
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
          clientId: m.clientId,
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
      tasksUpserted++
    }
  }

  await prisma.userSettings.upsert({
    where: { userId },
    update: { linearLastSyncedAt: new Date() },
    create: { userId, linearLastSyncedAt: new Date() },
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

  const issues = await client.issues({
    filter: { project: { id: { eq: linearProject.id } } } as never,
    first: 250,
  })

  const issueIds = issues.nodes.map((i) => i.id)
  const [enriched, existingTasks] = await Promise.all([
    Promise.all(
      issues.nodes.map(async (issue) => {
        const [team, state] = await Promise.all([issue.team, issue.state])
        return { issue, team, state }
      }),
    ),
    prisma.task.findMany({
      where: { linearIssueId: { in: issueIds } },
      select: { linearIssueId: true, invoiceId: true },
    }),
  ])

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
