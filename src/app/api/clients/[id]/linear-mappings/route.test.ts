import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetSession = vi.fn()
const mockFindFirstClient = vi.fn()
const mockFindManyMappings = vi.fn()
const mockCreateMapping = vi.fn()

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    client: { findFirst: (...args: unknown[]) => mockFindFirstClient(...args) },
    linearMapping: {
      findMany: (...args: unknown[]) => mockFindManyMappings(...args),
      create: (...args: unknown[]) => mockCreateMapping(...args),
    },
  },
}))

import { GET, POST } from "./route"

const MOCK_USER = { id: "user-1", name: "Test", email: "test@test.com" }
const MOCK_CLIENT = { id: "client-1", userId: "user-1", name: "Acme" }

function makeRequest(body?: unknown): Request {
  return new Request("http://localhost/api/clients/client-1/linear-mappings", {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

function makeContext(id = "client-1") {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue({ user: MOCK_USER })
  mockFindFirstClient.mockResolvedValue(MOCK_CLIENT)
})

describe("GET /api/clients/[id]/linear-mappings", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null)

    const res = await GET(makeRequest(), makeContext())
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error.code).toBe("AUTH_NOT_AUTHENTICATED")
  })

  it("returns 404 when client not found", async () => {
    mockFindFirstClient.mockResolvedValue(null)

    const res = await GET(makeRequest(), makeContext())
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("CLIENT_NOT_FOUND")
  })

  it("returns mappings for owned client", async () => {
    const mappings = [{ id: "m-1", clientId: "client-1", linearTeamId: "t-1" }]
    mockFindManyMappings.mockResolvedValue(mappings)

    const res = await GET(makeRequest(), makeContext())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual(mappings)
    expect(mockFindFirstClient).toHaveBeenCalledWith({
      where: { id: "client-1", userId: "user-1" },
    })
  })
})

describe("POST /api/clients/[id]/linear-mappings", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null)

    const res = await POST(makeRequest({ linearTeamId: "t-1" }), makeContext())
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error.code).toBe("AUTH_NOT_AUTHENTICATED")
  })

  it("returns 404 when client not found", async () => {
    mockFindFirstClient.mockResolvedValue(null)

    const res = await POST(makeRequest({ linearTeamId: "t-1" }), makeContext())
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("CLIENT_NOT_FOUND")
  })

  it("returns 400 for invalid input", async () => {
    const res = await POST(makeRequest({}), makeContext())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe("VAL_INVALID_INPUT")
  })

  it("creates mapping with valid input", async () => {
    const created = {
      id: "m-1",
      clientId: "client-1",
      linearTeamId: "t-1",
      linearProjectId: null,
    }
    mockCreateMapping.mockResolvedValue(created)

    const res = await POST(makeRequest({ linearTeamId: "t-1" }), makeContext())
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toEqual(created)
    expect(mockCreateMapping).toHaveBeenCalledWith({
      data: { clientId: "client-1", linearTeamId: "t-1" },
    })
  })

  it("returns 409 on duplicate mapping", async () => {
    const prismaError = new Error("Unique constraint failed")
    Object.assign(prismaError, { code: "P2002" })
    mockCreateMapping.mockRejectedValue(prismaError)

    const res = await POST(
      makeRequest({ linearProjectId: "p-1" }),
      makeContext(),
    )
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error.code).toBe("MAPPING_DUPLICATE")
  })
})
