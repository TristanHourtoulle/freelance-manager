import { beforeEach, describe, expect, it, vi } from "vitest"
import type { LinearClient } from "@linear/sdk"

const { prismaMock, rawRequest, LinearClientMock, decryptMock } = vi.hoisted(
  () => {
    const rawRequest = vi.fn()
    const prismaMock = {
      userSettings: { findUnique: vi.fn(), upsert: vi.fn() },
      linearMapping: { findMany: vi.fn() },
      task: { findMany: vi.fn(), createMany: vi.fn(), update: vi.fn() },
      project: { upsert: vi.fn(), update: vi.fn() },
      $transaction: vi.fn(),
    }
    return {
      prismaMock,
      rawRequest,
      LinearClientMock: vi.fn(function LinearClient() {
        return { client: { rawRequest } }
      }),
      decryptMock: vi.fn(() => "fake-token"),
    }
  },
)

vi.mock("@/lib/db", () => ({ prisma: prismaMock }))
vi.mock("@/lib/encryption", () => ({ decrypt: decryptMock, encrypt: vi.fn() }))
vi.mock("@linear/sdk", () => ({ LinearClient: LinearClientMock }))

const touchSyncRun = vi.fn()
const completeSyncRun = vi.fn()
vi.mock("@/lib/linear-sync-progress", () => ({
  touchSyncRun: (...a: unknown[]) => touchSyncRun(...a),
  completeSyncRun: (...a: unknown[]) => completeSyncRun(...a),
}))

import {
  fetchIssuesWithRelations,
  keyFromIdentifier,
  mapLinearPriority,
  mapLinearStateType,
  normalizeIssueNode,
  syncFromLinear,
} from "@/lib/linear"

interface RawNode {
  id: string
  identifier: string
  url: string | null
  title: string
  description: string | null
  priority: number | null
  estimate: number | null
  completedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  state: { name: string | null; type: string | null } | null
  team: { id: string; key: string | null } | null
  project: {
    id: string
    name: string
    description: string | null
    state: string | null
    createdAt: string | null
  } | null
}

function makeClient(nodes: RawNode[]): {
  client: LinearClient
  rawRequest: ReturnType<typeof vi.fn>
} {
  const rawRequest = vi.fn().mockResolvedValue({
    status: 200,
    data: { issues: { nodes } },
  })
  const client = { client: { rawRequest } } as unknown as LinearClient
  return { client, rawRequest }
}

describe("normalizeIssueNode", () => {
  it("converts ISO date strings to Date objects and preserves scalar fields", () => {
    const node: RawNode = {
      id: "issue-1",
      identifier: "TRI-543",
      url: "https://linear.app/acme/issue/TRI-543/ship-the-thing",
      title: "Ship the thing",
      description: "details",
      priority: 2,
      estimate: 3,
      completedAt: "2026-06-01T10:00:00.000Z",
      createdAt: "2026-05-01T08:00:00.000Z",
      updatedAt: "2026-05-20T09:30:00.000Z",
      state: { name: "Done", type: "completed" },
      team: { id: "team-1", key: "TRI" },
      project: {
        id: "project-1",
        name: "Alpha",
        description: "proj desc",
        state: "completed",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    }

    const result = normalizeIssueNode(node)

    expect(result.issue).toEqual({
      id: "issue-1",
      identifier: "TRI-543",
      url: "https://linear.app/acme/issue/TRI-543/ship-the-thing",
      title: "Ship the thing",
      description: "details",
      priority: 2,
      estimate: 3,
      completedAt: new Date("2026-06-01T10:00:00.000Z"),
      createdAt: new Date("2026-05-01T08:00:00.000Z"),
      updatedAt: new Date("2026-05-20T09:30:00.000Z"),
    })
    expect(result.project).toEqual({
      id: "project-1",
      name: "Alpha",
      description: "proj desc",
      state: "completed",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    })
    expect(result.team).toEqual({ id: "team-1", key: "TRI" })
    expect(result.state).toEqual({ name: "Done", type: "completed" })
  })

  it("maps missing relations and dates to null", () => {
    const node: RawNode = {
      id: "issue-2",
      identifier: "TRI-9",
      url: null,
      title: "Backlog item",
      description: null,
      priority: null,
      estimate: null,
      completedAt: null,
      createdAt: null,
      updatedAt: null,
      state: null,
      team: null,
      project: null,
    }

    const result = normalizeIssueNode(node)

    expect(result.issue.url).toBeNull()
    expect(result.issue.description).toBeNull()
    expect(result.issue.priority).toBeNull()
    expect(result.issue.estimate).toBeNull()
    expect(result.issue.completedAt).toBeNull()
    expect(result.issue.createdAt).toBeNull()
    expect(result.issue.updatedAt).toBeNull()
    expect(result.project).toBeNull()
    expect(result.team).toBeNull()
    expect(result.state).toBeNull()
  })
})

describe("fetchIssuesWithRelations", () => {
  it("issues a single raw GraphQL request with the given filter and first: 250", async () => {
    const { client, rawRequest } = makeClient([])
    const filter = { project: { id: { eq: "project-1" } } } as const

    await fetchIssuesWithRelations(client, filter)

    expect(rawRequest).toHaveBeenCalledTimes(1)
    const [, variables] = rawRequest.mock.calls[0]!
    expect(variables).toEqual({ filter, first: 250 })
  })

  it("returns normalized issues whose fields map to the expected Task shape", async () => {
    const { client } = makeClient([
      {
        id: "issue-1",
        identifier: "TRI-543",
        url: "https://linear.app/acme/issue/TRI-543/ship-the-thing",
        title: "Ship the thing",
        description: "details",
        priority: 1,
        estimate: 5,
        completedAt: "2026-06-01T10:00:00.000Z",
        createdAt: "2026-05-01T08:00:00.000Z",
        updatedAt: "2026-05-20T09:30:00.000Z",
        state: { name: "Done", type: "completed" },
        team: { id: "team-1", key: "TRI" },
        project: {
          id: "project-1",
          name: "Alpha",
          description: "proj desc",
          state: "completed",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      },
    ])

    const [enriched] = await fetchIssuesWithRelations(client, {
      team: { id: { eq: "team-1" } },
    })

    expect(enriched).toBeDefined()
    const { issue, state, team } = enriched!
    expect(mapLinearStateType(state?.type, false)).toBe("PENDING_INVOICE")
    expect(mapLinearStateType(state?.type, true)).toBe("DONE")
    expect(mapLinearPriority(issue.priority)).toBe("URGENT")
    expect(team?.key ?? keyFromIdentifier(issue.identifier)).toBe("TRI")
    expect(issue.estimate).toBe(5)
    expect(issue.completedAt).toEqual(new Date("2026-06-01T10:00:00.000Z"))
  })

  it("returns an empty array when the response has no data", async () => {
    const rawRequest = vi.fn().mockResolvedValue({ status: 200 })
    const client = { client: { rawRequest } } as unknown as LinearClient

    const result = await fetchIssuesWithRelations(client, {
      project: { id: { eq: "p" } },
    })

    expect(result).toEqual([])
  })
})

describe("syncFromLinear", () => {
  const TOKEN_SETTINGS = {
    linearApiTokenEncrypted: new Uint8Array([1, 2, 3]),
    linearApiTokenIv: new Uint8Array([4, 5, 6]),
    linearApiTokenKeyVersion: 1,
    linearLastSyncedAt: null as Date | null,
  }

  function issueNode(overrides: Partial<RawNode> = {}): RawNode {
    return {
      id: "issue-1",
      identifier: "TRI-1",
      url: "https://linear.app/acme/issue/TRI-1/task-one",
      title: "Task one",
      description: null,
      priority: 0,
      estimate: null,
      completedAt: null,
      createdAt: null,
      updatedAt: null,
      state: { name: "Todo", type: "unstarted" },
      team: { id: "team-1", key: "TRI" },
      project: {
        id: "lp-1",
        name: "Alpha",
        description: null,
        state: "started",
        createdAt: null,
      },
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.userSettings.findUnique.mockResolvedValue({ ...TOKEN_SETTINGS })
    prismaMock.userSettings.upsert.mockResolvedValue({})
    prismaMock.linearMapping.findMany.mockResolvedValue([
      {
        clientId: "client-1",
        linearProjectId: "lp-1",
        linearTeamId: null,
        client: {
          userId: "user-1",
          company: "Acme",
          firstName: "Ada",
          lastName: "Lovelace",
        },
      },
    ])
    prismaMock.task.findMany.mockResolvedValue([])
    prismaMock.task.createMany.mockResolvedValue({ count: 0 })
    prismaMock.task.update.mockResolvedValue({})
    prismaMock.project.upsert.mockResolvedValue({ id: "local-project-1" })
    prismaMock.project.update.mockResolvedValue({})
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock),
    )
    rawRequest.mockResolvedValue({
      status: 200,
      data: { issues: { nodes: [] } },
    })
  })

  it("creates new issues via createMany and never updates", async () => {
    rawRequest.mockResolvedValue({
      status: 200,
      data: { issues: { nodes: [issueNode()] } },
    })

    const result = await syncFromLinear("user-1")

    expect(prismaMock.task.createMany).toHaveBeenCalledTimes(1)
    const arg = prismaMock.task.createMany.mock.calls[0]![0]
    expect(arg.skipDuplicates).toBe(true)
    expect(arg.data).toHaveLength(1)
    expect(arg.data[0]).toMatchObject({
      linearIssueId: "issue-1",
      clientId: "client-1",
      projectId: "local-project-1",
      linearIdentifier: "TRI-1",
    })
    expect(prismaMock.task.update).not.toHaveBeenCalled()
    expect(result.tasks).toBe(1)
  })

  it("updates existing issues without clobbering invoiceId and keeps DONE status", async () => {
    prismaMock.task.findMany.mockResolvedValue([
      { linearIssueId: "issue-1", invoiceId: "inv-1" },
    ])
    rawRequest.mockResolvedValue({
      status: 200,
      data: {
        issues: {
          nodes: [issueNode({ state: { name: "Done", type: "completed" } })],
        },
      },
    })

    await syncFromLinear("user-1")

    expect(prismaMock.task.createMany).not.toHaveBeenCalled()
    expect(prismaMock.task.update).toHaveBeenCalledTimes(1)
    const arg = prismaMock.task.update.mock.calls[0]![0]
    expect(arg.where).toEqual({ linearIssueId: "issue-1" })
    expect(arg.data).not.toHaveProperty("invoiceId")
    expect(arg.data.status).toBe("DONE")
  })

  it("adds an incremental updatedAt filter when linearLastSyncedAt is set", async () => {
    const since = new Date("2026-01-01T00:00:00.000Z")
    prismaMock.userSettings.findUnique.mockResolvedValue({
      ...TOKEN_SETTINGS,
      linearLastSyncedAt: since,
    })

    await syncFromLinear("user-1")

    expect(rawRequest).toHaveBeenCalledTimes(1)
    const [, variables] = rawRequest.mock.calls[0]!
    expect(variables.filter).toEqual({
      project: { id: { eq: "lp-1" } },
      updatedAt: { gt: since.toISOString() },
    })
  })

  it("writes no task rows on a no-op incremental sync", async () => {
    prismaMock.userSettings.findUnique.mockResolvedValue({
      ...TOKEN_SETTINGS,
      linearLastSyncedAt: new Date("2026-01-01T00:00:00.000Z"),
    })
    rawRequest.mockResolvedValue({
      status: 200,
      data: { issues: { nodes: [] } },
    })

    const result = await syncFromLinear("user-1")

    expect(prismaMock.task.createMany).not.toHaveBeenCalled()
    expect(prismaMock.task.update).not.toHaveBeenCalled()
    expect(prismaMock.task.findMany).not.toHaveBeenCalled()
    expect(result.tasks).toBe(0)
    expect(prismaMock.userSettings.upsert).toHaveBeenCalledTimes(1)
  })

  describe("progress reporting", () => {
    function mapping(id: string, company: string | null) {
      return {
        clientId: `client-${id}`,
        linearProjectId: `lp-${id}`,
        linearTeamId: null,
        client: {
          userId: "user-1",
          company,
          firstName: "Ada",
          lastName: "Lovelace",
        },
      }
    }

    it("touches the run once per mapping, in order, before each fetch", async () => {
      prismaMock.linearMapping.findMany.mockResolvedValue([
        mapping("1", "Acme"),
        mapping("2", "Globex"),
        mapping("3", "Initech"),
      ])

      await syncFromLinear("user-1", "run-1")

      expect(touchSyncRun).toHaveBeenCalledTimes(3)
      expect(touchSyncRun.mock.calls.map((c) => c[1])).toEqual([
        { doneMappings: 0, currentLabel: "Acme" },
        { doneMappings: 1, currentLabel: "Globex" },
        { doneMappings: 2, currentLabel: "Initech" },
      ])
      expect(touchSyncRun.mock.calls.every((c) => c[0] === "run-1")).toBe(true)
    })

    it("falls back to the client's full name when no company is set", async () => {
      prismaMock.linearMapping.findMany.mockResolvedValue([mapping("1", null)])

      await syncFromLinear("user-1", "run-1")

      expect(touchSyncRun).toHaveBeenCalledWith("run-1", {
        doneMappings: 0,
        currentLabel: "Ada Lovelace",
      })
    })

    it("completes the run exactly once with the final counters", async () => {
      rawRequest.mockResolvedValue({
        status: 200,
        data: { issues: { nodes: [issueNode()] } },
      })

      await syncFromLinear("user-1", "run-1")

      expect(completeSyncRun).toHaveBeenCalledTimes(1)
      expect(completeSyncRun).toHaveBeenCalledWith("run-1", {
        projectsUpserted: 1,
        tasksUpserted: 1,
      })
    })

    it("never writes progress from inside the phase-2 transaction", async () => {
      let insideTransaction = false
      prismaMock.$transaction.mockImplementation(
        async (fn: (tx: typeof prismaMock) => unknown) => {
          insideTransaction = true
          const out = await fn(prismaMock)
          insideTransaction = false
          return out
        },
      )
      touchSyncRun.mockImplementation(() => {
        expect(insideTransaction).toBe(false)
      })
      rawRequest.mockResolvedValue({
        status: 200,
        data: { issues: { nodes: [issueNode()] } },
      })

      await syncFromLinear("user-1", "run-1")

      expect(completeSyncRun).toHaveBeenCalledTimes(1)
    })

    it("reports no progress when called without a runId", async () => {
      await syncFromLinear("user-1")

      expect(touchSyncRun).toHaveBeenCalledWith(undefined, expect.anything())
      expect(completeSyncRun).toHaveBeenCalledWith(undefined, expect.anything())
    })
  })
})
