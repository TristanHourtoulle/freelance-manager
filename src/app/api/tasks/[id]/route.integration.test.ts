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
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "task_id")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function patchRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/tasks/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("PATCH /api/tasks/[id] (integration)", () => {
  it("updates actualDays on the caller's own task", async () => {
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

    const { PATCH } = await import("./route")
    const res = await PATCH(patchRequest({ actualDays: 2.5 }), {
      params: Promise.resolve({ id: task.id }),
    })
    const body = (await res.json()) as { actualDays: number }

    expect(res.status).toBe(200)
    expect(body.actualDays).toBe(2.5)
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

    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest({
        billability: { billable: false, nonBillableReason: null },
      }),
      { params: Promise.resolve({ id: task.id }) },
    )

    expect(res.status).toBe(400)
  })

  it("returns 404 (never 200) when patching another user's task", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const ownerProject = await makeProject(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
    })
    const task = await makeTask(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
      projectId: ownerProject.id,
    })

    const { PATCH } = await import("./route")
    const res = await PATCH(patchRequest({ actualDays: 99 }), {
      params: Promise.resolve({ id: task.id }),
    })

    expect(res.status).toBe(404)
    const untouched = await ctx.prisma.task.findUniqueOrThrow({
      where: { id: task.id },
    })
    expect(untouched.actualDays).toBeNull()
  })
})
