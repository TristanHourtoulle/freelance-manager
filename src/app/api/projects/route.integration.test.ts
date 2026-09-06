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
import {
  makeClient,
  makeProject,
  makeTask,
  makeUser,
} from "@/test/integration/factories"
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

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "projects_list")
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function getRequest(qs = ""): Request {
  return new Request(`http://localhost/api/projects${qs}`)
}

interface ProjectListResponse {
  data: { id: string; remainingDays: number; tasksTotal: number }[]
  nextCursor: string | null
  hasMore: boolean
}

describe("GET /api/projects (integration)", () => {
  it("never returns another user's projects on the default (cached) page", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    await makeProject(ctx.prisma, { userId: owner.id, clientId: ownerClient.id })

    const { GET } = await import("./route")
    const res = await GET(getRequest())
    const body = (await res.json()) as ProjectListResponse

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(0)
  })

  it("sums remainingDays over open tasks only, excluding done/canceled/invoiced work (select-completeness)", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const project = await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
      status: "BACKLOG",
      estimate: 2,
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
      status: "IN_PROGRESS",
      estimate: 3,
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
      status: "DONE",
      estimate: 100,
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
      status: "PENDING_INVOICE",
      estimate: 100,
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest())
    const body = (await res.json()) as ProjectListResponse

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]?.remainingDays).toBe(5)
    expect(body.data[0]?.tasksTotal).toBe(4)
    expect(typeof body.data[0]?.remainingDays).toBe("number")
  })

  it("filters by name/key search and never returns another user's projects (bypass-cache path)", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      name: "Findable Project",
    })
    await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      name: "Other Project",
    })
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    await makeProject(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
      name: "Findable Project",
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest("?q=Findable"))
    const body = (await res.json()) as ProjectListResponse

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
  })

  it("rejects an out-of-range limit with 400 instead of a 500", async () => {
    const { GET } = await import("./route")
    const res = await GET(getRequest("?limit=0"))

    expect(res.status).toBe(400)
  })
})
