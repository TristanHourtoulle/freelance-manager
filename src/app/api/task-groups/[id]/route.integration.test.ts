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
  makeInvoice,
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
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "task_group_id")
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
  return new Request("http://localhost/api/task-groups/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function deleteRequest(): Request {
  return new Request("http://localhost/api/task-groups/x", {
    method: "DELETE",
  })
}

describe("PATCH /api/task-groups/[id] (integration)", () => {
  it("renames the group and updates its task membership", async () => {
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
    const group = await ctx.prisma.taskGroup.create({
      data: { userId: currentUser.id, clientId: client.id, name: "Old" },
    })
    await ctx.prisma.task.update({
      where: { id: task1.id },
      data: { taskGroupId: group.id },
    })

    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest({ name: "New", taskIds: [task2.id] }),
      { params: Promise.resolve({ id: group.id }) },
    )

    expect(res.status).toBe(200)
    const updated = await ctx.prisma.taskGroup.findUniqueOrThrow({
      where: { id: group.id },
    })
    expect(updated.name).toBe("New")
    const [reloaded1, reloaded2] = await Promise.all([
      ctx.prisma.task.findUniqueOrThrow({ where: { id: task1.id } }),
      ctx.prisma.task.findUniqueOrThrow({ where: { id: task2.id } }),
    ])
    expect(reloaded1.taskGroupId).toBeNull()
    expect(reloaded2.taskGroupId).toBe(group.id)
  })

  it("returns 404 (never 200) for another user's group", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const group = await ctx.prisma.taskGroup.create({
      data: { userId: owner.id, clientId: ownerClient.id, name: "Private" },
    })

    const { PATCH } = await import("./route")
    const res = await PATCH(patchRequest({ name: "Hijacked", taskIds: [] }), {
      params: Promise.resolve({ id: group.id }),
    })

    expect(res.status).toBe(404)
  })

  it("returns 409 when the group is already invoiced", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })
    const group = await ctx.prisma.taskGroup.create({
      data: {
        userId: currentUser.id,
        clientId: client.id,
        name: "Invoiced",
        invoiceId: invoice.id,
      },
    })

    const { PATCH } = await import("./route")
    const res = await PATCH(patchRequest({ name: "Edited", taskIds: [] }), {
      params: Promise.resolve({ id: group.id }),
    })

    expect(res.status).toBe(409)
  })
})

describe("DELETE /api/task-groups/[id] (integration)", () => {
  it("deletes the group and releases its tasks", async () => {
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
    const group = await ctx.prisma.taskGroup.create({
      data: { userId: currentUser.id, clientId: client.id, name: "Doomed" },
    })
    await ctx.prisma.task.update({
      where: { id: task.id },
      data: { taskGroupId: group.id },
    })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: group.id }),
    })

    expect(res.status).toBe(200)
    const remainingGroup = await ctx.prisma.taskGroup.findUnique({
      where: { id: group.id },
    })
    expect(remainingGroup).toBeNull()
    const releasedTask = await ctx.prisma.task.findUniqueOrThrow({
      where: { id: task.id },
    })
    expect(releasedTask.taskGroupId).toBeNull()
  })

  it("returns 404 (never 200) when deleting another user's group", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const group = await ctx.prisma.taskGroup.create({
      data: { userId: owner.id, clientId: ownerClient.id, name: "Private" },
    })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: group.id }),
    })

    expect(res.status).toBe(404)
    const untouched = await ctx.prisma.taskGroup.findUnique({
      where: { id: group.id },
    })
    expect(untouched).not.toBeNull()
  })
})
