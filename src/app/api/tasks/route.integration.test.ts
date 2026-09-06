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

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "tasks_list")
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function getRequest(qs = ""): Request {
  return new Request(`http://localhost/api/tasks${qs}`)
}

interface TaskListResponse {
  data: { id: string; billable: boolean; clientId: string }[]
  nextCursor: string | null
  hasMore: boolean
}

describe("GET /api/tasks (integration)", () => {
  it("never returns another user's tasks", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const ownerProject = await makeProject(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
    })
    await makeTask(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
      projectId: ownerProject.id,
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest())
    const body = (await res.json()) as TaskListResponse

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(0)
  })

  it("filters by billable and by clientIds/projectIds multi-select", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const otherClient = await makeClient(ctx.prisma, {
      userId: currentUser.id,
    })
    const project = await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })
    const otherProject = await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: otherClient.id,
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
      billable: true,
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
      billable: false,
      nonBillableReason: "OTHER",
      nonBillableNote: "n/a",
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: otherClient.id,
      projectId: otherProject.id,
      billable: true,
    })

    const { GET } = await import("./route")
    const res = await GET(
      getRequest(`?billable=true&clientIds=${client.id}`),
    )
    const body = (await res.json()) as TaskListResponse

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]?.clientId).toBe(client.id)
  })

  it("rejects more than 200 ids in clientIds with 400 instead of a 500", async () => {
    const tooMany = Array.from({ length: 201 }, (_, i) => `id-${i}`).join(",")

    const { GET } = await import("./route")
    const res = await GET(getRequest(`?clientIds=${tooMany}`))

    expect(res.status).toBe(400)
  })

  it("computes the chip-count aggregate from real task rows via the raw SQL (summary=status)", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const project = await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
      status: "PENDING_INVOICE",
      estimate: null,
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
      status: "DONE",
      invoiceId: null,
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
      status: "IN_PROGRESS",
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
      status: "CANCELED",
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
      billable: false,
      nonBillableReason: "OTHER",
      nonBillableNote: "x",
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest("?summary=status"))
    const body = (await res.json()) as {
      all: number
      pending: number
      done: number
      in_progress: number
      non_billable: number
      unestimatedCount: number
    }

    expect(res.status).toBe(200)
    expect(body.all).toBe(4)
    expect(body.pending).toBe(2)
    expect(body.done).toBe(1)
    expect(body.in_progress).toBe(1)
    expect(body.non_billable).toBe(1)
    expect(body.unestimatedCount).toBe(1)
  })
})
