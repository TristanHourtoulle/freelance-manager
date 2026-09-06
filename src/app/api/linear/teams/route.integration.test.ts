import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
  vi,
} from "vitest"
import {
  createIsolatedSchema,
  dropIsolatedSchema,
  truncateAll,
  type IsolatedSchema,
} from "@/test/integration/db"
import { makeUser } from "@/test/integration/factories"
import type { ApiUser } from "@/lib/api"

let ctx: IsolatedSchema
let currentUser: ApiUser

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getAuthUser: async () => currentUser }
})
vi.mock("@/lib/db", () => ({
  get prisma() {
    return ctx.prisma
  },
}))
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

const { teamsMock, LinearClientMock } = vi.hoisted(() => {
  const teamsMock = vi.fn()
  return {
    teamsMock,
    LinearClientMock: vi.fn(function LinearClient() {
      return { teams: teamsMock }
    }),
  }
})
vi.mock("@linear/sdk", () => ({ LinearClient: LinearClientMock }))

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "linear_teams")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
  LinearClientMock.mockClear()
  teamsMock.mockReset()
  teamsMock.mockResolvedValue({
    nodes: [{ id: "team-1", key: "ENG", name: "Engineering" }],
  })
})

interface TeamsResponse {
  items: { id: string; key: string; name: string }[]
}

describe("GET /api/linear/teams (integration)", () => {
  it("returns 401 for an unauthenticated caller", async () => {
    currentUser = null as unknown as ApiUser
    const { GET } = await import("./route")
    const res = await GET()

    expect(res.status).toBe(401)
    expect(LinearClientMock).not.toHaveBeenCalled()
  })

  it("returns an empty list when the user has no Linear token, without calling the SDK", async () => {
    const { GET } = await import("./route")
    const res = await GET()
    const body = (await res.json()) as TeamsResponse

    expect(res.status).toBe(200)
    expect(body.items).toEqual([])
    expect(LinearClientMock).not.toHaveBeenCalled()
  })

  it("decrypts the stored token and calls the real Linear SDK boundary only, never the network", async () => {
    const { setLinearToken } = await import("@/lib/linear")
    await setLinearToken(
      currentUser.id,
      "fake-integration-test-linear-token-teams-1234567890",
    )

    const { GET } = await import("./route")
    const res = await GET()
    const body = (await res.json()) as TeamsResponse

    expect(res.status).toBe(200)
    expect(body.items).toEqual([
      { id: "team-1", key: "ENG", name: "Engineering" },
    ])
    expect(LinearClientMock).toHaveBeenCalledWith({
      apiKey: "fake-integration-test-linear-token-teams-1234567890",
    })
    expect(teamsMock).toHaveBeenCalledWith({ first: 100 })
  })
})
