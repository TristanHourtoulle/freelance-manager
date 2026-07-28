import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    activityLog: { create: vi.fn() },
    client: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))

import { getClient, listClients } from "./clients"

const USER_ID = "user-1"

function clientRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "client-1",
    firstName: "Marie",
    lastName: "Durand",
    company: "Acme",
    billingMode: "DAILY",
    rate: 500,
    category: "FREELANCE",
    stage: "ACTIVE",
    starred: false,
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.activityLog.create.mockResolvedValue({})
})

describe("listClients", () => {
  it("scopes the query to the principal and excludes archived by default", async () => {
    prismaMock.client.findMany.mockResolvedValue([clientRow()])
    const result = await listClients(USER_ID, {
      limit: 25,
      includeArchived: false,
    })
    expect(result.isError).toBeUndefined()
    const call = prismaMock.client.findMany.mock.calls[0]![0] as {
      where: Record<string, unknown>
    }
    expect(call.where).toEqual({ userId: USER_ID, archivedAt: null })
  })

  it("truncates name fields to a bounded length", async () => {
    prismaMock.client.findMany.mockResolvedValue([
      clientRow({ company: "c".repeat(400) }),
    ])
    const result = await listClients(USER_ID, {
      limit: 25,
      includeArchived: false,
    })
    const { data } = result.structuredContent as {
      data: { company: string }[]
    }
    expect(data[0]!.company).toHaveLength(121)
  })

  it("writes an audit row for the call", async () => {
    prismaMock.client.findMany.mockResolvedValue([])
    await listClients(USER_ID, { limit: 25, includeArchived: false })
    const entry = prismaMock.activityLog.create.mock.calls[0]![0] as {
      data: { kind: string; title: string }
    }
    expect(entry.data.kind).toBe("MCP_TOOL_CALL")
    expect(entry.data.title).toBe("Appel MCP list_clients (succès)")
  })
})

describe("getClient", () => {
  it("returns not-found for a client owned by another user, never data", async () => {
    prismaMock.client.findFirst.mockResolvedValue(null)
    const result = await getClient(USER_ID, { clientId: "foreign-client" })
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({ text: "Client not found" })
    expect(prismaMock.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "foreign-client", userId: USER_ID },
      }),
    )
  })

  it("truncates the notes free text", async () => {
    prismaMock.client.findFirst.mockResolvedValue(
      clientRow({
        email: "marie@acme.fr",
        phone: null,
        paymentTerms: 30,
        fixedPrice: null,
        deposit: null,
        notes: "n".repeat(2000),
      }),
    )
    const result = await getClient(USER_ID, { clientId: "client-1" })
    const structured = result.structuredContent as { notes: string }
    expect(structured.notes).toHaveLength(501)
    expect(structured.notes.endsWith("…")).toBe(true)
  })
})
