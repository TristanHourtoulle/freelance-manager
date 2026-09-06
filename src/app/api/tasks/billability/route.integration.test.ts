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
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "task_billability")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/tasks/billability", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/tasks/billability (integration)", () => {
  it("bulk-updates billability only for the caller's own tasks", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const project = await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })
    const own1 = await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
    })
    const own2 = await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
    })
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const ownerProject = await makeProject(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
    })
    const foreign = await makeTask(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
      projectId: ownerProject.id,
    })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({
        taskIds: [own1.id, own2.id, foreign.id],
        billable: false,
        nonBillableReason: "COMMERCIAL_GESTURE",
      }),
    )
    const body = (await res.json()) as { updated: number }

    expect(res.status).toBe(200)
    expect(body.updated).toBe(2)
    const untouched = await ctx.prisma.task.findUniqueOrThrow({
      where: { id: foreign.id },
    })
    expect(untouched.billable).toBe(true)
  })

  it("accepts exactly 500 task ids", async () => {
    const taskIds = Array.from({ length: 500 }, (_, i) => `id-${i}`)

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({
        taskIds,
        billable: false,
        nonBillableReason: "OTHER",
        nonBillableNote: "bulk",
      }),
    )

    expect(res.status).toBe(200)
  })

  it("rejects 501 task ids with 400 instead of a 500", async () => {
    const taskIds = Array.from({ length: 501 }, (_, i) => `id-${i}`)

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({
        taskIds,
        billable: false,
        nonBillableReason: "OTHER",
        nonBillableNote: "bulk",
      }),
    )

    expect(res.status).toBe(400)
  })

  it("rejects a non-billable payload without a reason with 400", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const project = await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })
    const task = await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
    })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({ taskIds: [task.id], billable: false }),
    )

    expect(res.status).toBe(400)
  })
})
