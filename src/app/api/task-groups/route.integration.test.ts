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
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "task_groups")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function getRequest(qs = ""): Request {
  return new Request(`http://localhost/api/task-groups${qs}`)
}

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/task-groups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

interface TaskGroupResponse {
  id: string
  clientId: string
  tasks: { id: string }[]
}

describe("GET /api/task-groups (integration)", () => {
  it("never returns another user's task groups", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    await ctx.prisma.taskGroup.create({
      data: { userId: owner.id, clientId: ownerClient.id, name: "Private" },
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest())
    const body = (await res.json()) as TaskGroupResponse[]

    expect(res.status).toBe(200)
    expect(body).toHaveLength(0)
  })
})

describe("POST /api/task-groups (integration)", () => {
  it("groups eligible tasks and claims them (taskGroupId set)", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const project = await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })
    const task1 = await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
    })
    const task2 = await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
    })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({
        clientId: client.id,
        name: "Sprint 1",
        taskIds: [task1.id, task2.id],
      }),
    )
    const body = (await res.json()) as TaskGroupResponse

    expect(res.status).toBe(201)
    expect(body.tasks).toHaveLength(2)
    const rows = await ctx.prisma.task.findMany({
      where: { id: { in: [task1.id, task2.id] } },
    })
    expect(rows.every((t) => t.taskGroupId === body.id)).toBe(true)
  })

  it("returns 409 when a task is not groupable (already invoiced/grouped/wrong status)", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const project = await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })
    const doneTask = await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
      status: "DONE",
    })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({
        clientId: client.id,
        name: "Sprint 1",
        taskIds: [doneTask.id],
      }),
    )

    expect(res.status).toBe(409)
  })

  it("rejects creating a group under another user's client (never 200)", async () => {
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

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({
        clientId: ownerClient.id,
        name: "Hijack",
        taskIds: [task.id],
      }),
    )

    expect(res.status).not.toBe(200)
    const groups = await ctx.prisma.taskGroup.count({
      where: { clientId: ownerClient.id },
    })
    expect(groups).toBe(0)
  })

  it("rejects duplicate task ids in the same group with 400", async () => {
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
      postRequest({
        clientId: client.id,
        name: "Dup",
        taskIds: [task.id, task.id],
      }),
    )

    expect(res.status).toBe(400)
  })
})
