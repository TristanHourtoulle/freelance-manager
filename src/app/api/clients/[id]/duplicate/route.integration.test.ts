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
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))

beforeAll(() => {
  ctx = createIsolatedSchema(
    inject("integrationPostgresUrl"),
    "client_duplicate",
  )
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function postRequest(): Request {
  return new Request("http://localhost/api/clients/x/duplicate", {
    method: "POST",
  })
}

describe("POST /api/clients/[id]/duplicate (integration)", () => {
  it("copies only the client row — no invoices, projects, or tasks are duplicated", async () => {
    const source = await makeClient(ctx.prisma, {
      userId: currentUser.id,
      company: "Acme Corp",
    })
    const project = await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: source.id,
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: source.id,
      projectId: project.id,
    })
    await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: source.id,
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest(), {
      params: Promise.resolve({ id: source.id }),
    })
    const body = (await res.json()) as { id: string }

    expect(res.status).toBe(201)
    const [invoiceCount, projectCount, taskCount] = await Promise.all([
      ctx.prisma.invoice.count({ where: { clientId: body.id } }),
      ctx.prisma.project.count({ where: { clientId: body.id } }),
      ctx.prisma.task.count({ where: { clientId: body.id } }),
    ])
    expect(invoiceCount).toBe(0)
    expect(projectCount).toBe(0)
    expect(taskCount).toBe(0)

    const created = await ctx.prisma.client.findUniqueOrThrow({
      where: { id: body.id },
    })
    expect(created.company).toBe("Acme Corp (copie)")
    expect(created.userId).toBe(currentUser.id)

    const stillOwnsOriginal = await ctx.prisma.project.count({
      where: { clientId: source.id },
    })
    expect(stillOwnsOriginal).toBe(1)
  })

  it("returns 404 (never 200) for another user's client", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })

    const { POST } = await import("./route")
    const res = await POST(postRequest(), {
      params: Promise.resolve({ id: ownerClient.id }),
    })

    expect(res.status).toBe(404)
    const clientCount = await ctx.prisma.client.count({
      where: { userId: currentUser.id },
    })
    expect(clientCount).toBe(0)
  })
})
