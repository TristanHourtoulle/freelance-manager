import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetSession = vi.fn()
const mockFindFirstClient = vi.fn()
const mockFindFirstMapping = vi.fn()
const mockDeleteMapping = vi.fn()

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
      findFirst: (...args: unknown[]) => mockFindFirstMapping(...args),
      delete: (...args: unknown[]) => mockDeleteMapping(...args),
    },
  },
}))

import { DELETE } from "./route"

const MOCK_USER = { id: "user-1", name: "Test", email: "test@test.com" }
const MOCK_CLIENT = { id: "client-1", userId: "user-1", name: "Acme" }
const MOCK_MAPPING = { id: "m-1", clientId: "client-1", linearTeamId: "t-1" }

function makeRequest(): Request {
  return new Request(
    "http://localhost/api/clients/client-1/linear-mappings/m-1",
    { method: "DELETE" },
  )
}

function makeContext(id = "client-1", mappingId = "m-1") {
  return { params: Promise.resolve({ id, mappingId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue({ user: MOCK_USER })
  mockFindFirstClient.mockResolvedValue(MOCK_CLIENT)
  mockFindFirstMapping.mockResolvedValue(MOCK_MAPPING)
  mockDeleteMapping.mockResolvedValue(MOCK_MAPPING)
})

describe("DELETE /api/clients/[id]/linear-mappings/[mappingId]", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null)

    const res = await DELETE(makeRequest(), makeContext())
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error.code).toBe("AUTH_NOT_AUTHENTICATED")
  })

  it("returns 404 when client not found", async () => {
    mockFindFirstClient.mockResolvedValue(null)

    const res = await DELETE(makeRequest(), makeContext())
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("CLIENT_NOT_FOUND")
  })

  it("returns 404 when mapping not found", async () => {
    mockFindFirstMapping.mockResolvedValue(null)

    const res = await DELETE(makeRequest(), makeContext())
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("MAPPING_NOT_FOUND")
  })

  it("deletes mapping and returns 204", async () => {
    const res = await DELETE(makeRequest(), makeContext())

    expect(res.status).toBe(204)
    expect(mockDeleteMapping).toHaveBeenCalledWith({
      where: { id: "m-1" },
    })
  })

  it("verifies ownership via client userId filter", async () => {
    await DELETE(makeRequest(), makeContext())

    expect(mockFindFirstClient).toHaveBeenCalledWith({
      where: { id: "client-1", userId: "user-1" },
    })
  })

  it("verifies mapping belongs to client", async () => {
    await DELETE(makeRequest(), makeContext())

    expect(mockFindFirstMapping).toHaveBeenCalledWith({
      where: { id: "m-1", clientId: "client-1" },
    })
  })
})
