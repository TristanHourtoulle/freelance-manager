import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    activityLog: { create: vi.fn() },
    client: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    linearMapping: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))

import { clientCreateSchema } from "@/lib/schemas/client"
import {
  createClient,
  getClient,
  linkLinearProject,
  listClients,
  updateClient,
} from "./clients"

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
    email: null,
    phone: null,
    paymentTerms: null,
    fixedPrice: null,
    deposit: null,
    notes: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.activityLog.create.mockResolvedValue({})
})

describe("listClients", () => {
  it("scopes the query to the principal and excludes archived by default", async () => {
    prismaMock.client.count.mockResolvedValue(1)
    prismaMock.client.findMany.mockResolvedValue([clientRow()])
    const result = await listClients(USER_ID, {
      limit: 25,
      fetchAll: false,
      includeArchived: false,
    })
    expect(result.isError).toBeUndefined()
    const call = prismaMock.client.findMany.mock.calls[0]![0] as {
      where: Record<string, unknown>
    }
    expect(call.where).toEqual({ userId: USER_ID, archivedAt: null })
    expect(prismaMock.client.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, archivedAt: null },
    })
  })

  it("truncates name fields to a bounded length", async () => {
    prismaMock.client.count.mockResolvedValue(1)
    prismaMock.client.findMany.mockResolvedValue([
      clientRow({ company: "c".repeat(400) }),
    ])
    const result = await listClients(USER_ID, {
      limit: 25,
      fetchAll: false,
      includeArchived: false,
    })
    const { data } = result.structuredContent as {
      data: { company: string }[]
    }
    expect(data[0]!.company).toHaveLength(121)
  })

  it("reports the real DB count as total, never rows.length", async () => {
    prismaMock.client.count.mockResolvedValue(194)
    prismaMock.client.findMany.mockResolvedValue([clientRow()])
    const result = await listClients(USER_ID, {
      limit: 25,
      fetchAll: false,
      includeArchived: false,
    })
    const structured = result.structuredContent as {
      total: number
      truncated: boolean
    }
    expect(structured.total).toBe(194)
    expect(structured.truncated).toBe(false)
  })

  it("writes an audit row for the call", async () => {
    prismaMock.client.count.mockResolvedValue(0)
    prismaMock.client.findMany.mockResolvedValue([])
    await listClients(USER_ID, {
      limit: 25,
      fetchAll: false,
      includeArchived: false,
    })
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
        paymentTerms: 30,
        notes: "n".repeat(2000),
      }),
    )
    const result = await getClient(USER_ID, { clientId: "client-1" })
    const structured = result.structuredContent as { notes: string }
    expect(structured.notes).toHaveLength(501)
    expect(structured.notes.endsWith("…")).toBe(true)
  })
})

describe("createClient", () => {
  it("creates the client and returns its detail", async () => {
    prismaMock.client.create.mockResolvedValue(clientRow())
    const result = await createClient(USER_ID, {
      firstName: "Marie",
      lastName: "Durand",
      billingMode: "DAILY",
      rate: 500,
      category: "FREELANCE",
      stage: "ACTIVE",
    })
    expect(result.isError).toBeUndefined()
    const call = prismaMock.client.create.mock.calls[0]![0] as {
      data: Record<string, unknown>
    }
    expect(call.data.userId).toBe(USER_ID)
    expect(call.data.firstName).toBe("Marie")
    const structured = result.structuredContent as { id: string }
    expect(structured.id).toBe("client-1")
  })

  it("rejects FIXED billing mode without a positive fixedPrice", () => {
    const parsed = clientCreateSchema.safeParse({
      firstName: "Marie",
      lastName: "Durand",
      billingMode: "FIXED",
      fixedPrice: 0,
    })
    expect(parsed.success).toBe(false)
  })
})

describe("updateClient", () => {
  it("returns not-found for a foreign clientId without writing", async () => {
    prismaMock.client.findFirst.mockResolvedValue(null)
    const result = await updateClient(USER_ID, {
      clientId: "foreign-client",
      firstName: "Nope",
    })
    expect(result.isError).toBe(true)
    expect(prismaMock.client.update).not.toHaveBeenCalled()
  })

  it("only patches fields present in the call", async () => {
    prismaMock.client.findFirst.mockResolvedValue({
      id: "client-1",
      firstName: "Marie",
      lastName: "Durand",
      company: "Acme",
    })
    prismaMock.client.update.mockResolvedValue(clientRow({ starred: true }))
    await updateClient(USER_ID, { clientId: "client-1", starred: true })
    const call = prismaMock.client.update.mock.calls[0]![0] as {
      where: { id: string }
      data: Record<string, unknown>
    }
    expect(call.where).toEqual({ id: "client-1" })
    expect(call.data).toEqual({ starred: true })
  })
})

describe("linkLinearProject", () => {
  it("returns not-found for a foreign clientId", async () => {
    prismaMock.client.findFirst.mockResolvedValue(null)
    const result = await linkLinearProject(USER_ID, {
      clientId: "foreign-client",
      linearProjectId: "linear-proj-1",
      linearTeamId: null,
    })
    expect(result.isError).toBe(true)
    expect(prismaMock.linearMapping.create).not.toHaveBeenCalled()
  })

  it("fails with a domain error when the project is linked to another client", async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1" })
    prismaMock.linearMapping.findFirst.mockResolvedValue({
      id: "mapping-1",
      clientId: "other-client",
      linearTeamId: null,
      linearProjectId: "linear-proj-1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      client: { firstName: "Paul", lastName: "Martin", company: null },
    })
    const result = await linkLinearProject(USER_ID, {
      clientId: "client-1",
      linearProjectId: "linear-proj-1",
      linearTeamId: null,
    })
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining("already linked to client Paul Martin"),
    })
    expect(prismaMock.linearMapping.create).not.toHaveBeenCalled()
  })

  it("is idempotent: resubmitting the same client/project returns the existing row", async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1" })
    prismaMock.linearMapping.findFirst.mockResolvedValue({
      id: "mapping-1",
      clientId: "client-1",
      linearTeamId: null,
      linearProjectId: "linear-proj-1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      client: { firstName: "Marie", lastName: "Durand", company: "Acme" },
    })
    const result = await linkLinearProject(USER_ID, {
      clientId: "client-1",
      linearProjectId: "linear-proj-1",
      linearTeamId: null,
    })
    expect(result.isError).toBeUndefined()
    expect(prismaMock.linearMapping.create).not.toHaveBeenCalled()
    const structured = result.structuredContent as { id: string }
    expect(structured.id).toBe("mapping-1")
  })

  it("creates a new mapping when none exists yet", async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1" })
    prismaMock.linearMapping.findFirst.mockResolvedValue(null)
    prismaMock.linearMapping.create.mockResolvedValue({
      id: "mapping-2",
      clientId: "client-1",
      linearTeamId: null,
      linearProjectId: "linear-proj-2",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    })
    const result = await linkLinearProject(USER_ID, {
      clientId: "client-1",
      linearProjectId: "linear-proj-2",
      linearTeamId: null,
    })
    expect(result.isError).toBeUndefined()
    expect(prismaMock.linearMapping.create).toHaveBeenCalledWith({
      data: {
        clientId: "client-1",
        linearTeamId: null,
        linearProjectId: "linear-proj-2",
      },
    })
  })
})
