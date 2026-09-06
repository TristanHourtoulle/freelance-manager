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

const { projectsMock, teamMock, teamProjectsMock, LinearClientMock } =
  vi.hoisted(() => {
    const projectsMock = vi.fn()
    const teamProjectsMock = vi.fn()
    const teamMock = vi.fn(() => ({ projects: teamProjectsMock }))
    return {
      projectsMock,
      teamMock,
      teamProjectsMock,
      LinearClientMock: vi.fn(function LinearClient() {
        return { projects: projectsMock, team: teamMock }
      }),
    }
  })
vi.mock("@linear/sdk", () => ({ LinearClient: LinearClientMock }))

beforeAll(() => {
  ctx = createIsolatedSchema(
    inject("integrationPostgresUrl"),
    "linear_projects",
  )
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
  LinearClientMock.mockClear()
  projectsMock.mockReset()
  teamMock.mockClear()
  teamProjectsMock.mockReset()
  projectsMock.mockResolvedValue({
    nodes: [{ id: "proj-1", name: "Website", description: null }],
  })
  teamProjectsMock.mockResolvedValue({
    nodes: [{ id: "proj-2", name: "Team-scoped", description: "d" }],
  })
})

function getRequest(qs = ""): Request {
  return new Request(`http://localhost/api/linear/projects${qs}`)
}

interface ProjectsResponse {
  items: { id: string; name: string; description: string | null }[]
}

describe("GET /api/linear/projects (integration)", () => {
  it("returns 401 for an unauthenticated caller", async () => {
    currentUser = null as unknown as ApiUser
    const { GET } = await import("./route")
    const res = await GET(getRequest())

    expect(res.status).toBe(401)
    expect(LinearClientMock).not.toHaveBeenCalled()
  })

  it("returns an empty list when the user has no Linear token, without calling the SDK", async () => {
    const { GET } = await import("./route")
    const res = await GET(getRequest())
    const body = (await res.json()) as ProjectsResponse

    expect(res.status).toBe(200)
    expect(body.items).toEqual([])
    expect(LinearClientMock).not.toHaveBeenCalled()
  })

  it("lists all projects through the real SDK boundary when no teamId is given", async () => {
    const { setLinearToken } = await import("@/lib/linear")
    await setLinearToken(
      currentUser.id,
      "fake-integration-test-linear-token-projects-123456",
    )

    const { GET } = await import("./route")
    const res = await GET(getRequest())
    const body = (await res.json()) as ProjectsResponse

    expect(res.status).toBe(200)
    expect(body.items).toEqual([
      { id: "proj-1", name: "Website", description: null },
    ])
    expect(projectsMock).toHaveBeenCalledWith({ first: 100 })
    expect(teamMock).not.toHaveBeenCalled()
  })

  it("scopes to a team's projects when teamId is given", async () => {
    const { setLinearToken } = await import("@/lib/linear")
    await setLinearToken(
      currentUser.id,
      "fake-integration-test-linear-token-projects-123456",
    )

    const { GET } = await import("./route")
    const res = await GET(getRequest("?teamId=team-1"))
    const body = (await res.json()) as ProjectsResponse

    expect(res.status).toBe(200)
    expect(body.items).toEqual([
      { id: "proj-2", name: "Team-scoped", description: "d" },
    ])
    expect(teamMock).toHaveBeenCalledWith("team-1")
    expect(projectsMock).not.toHaveBeenCalled()
  })
})
