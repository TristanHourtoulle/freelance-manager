import { describe, expect, it, vi } from "vitest"
import type { LinearClient } from "@linear/sdk"
import {
  fetchIssuesWithRelations,
  keyFromIdentifier,
  mapLinearPriority,
  mapLinearStateType,
  normalizeIssueNode,
} from "@/lib/linear"

interface RawNode {
  id: string
  identifier: string
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
