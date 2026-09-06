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
  makeActivityLog,
  makeClient,
  makeMeeting,
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
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "clients_list")
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
  return new Request(`http://localhost/api/clients${qs}`)
}

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/clients", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

interface ClientListResponse {
  data: { id: string; rate: number; fixedPrice: number | null }[]
  nextCursor: string | null
  hasMore: boolean
}

interface BillableSummaryResponse {
  byClient: Record<
    string,
    { count: number; value: number; unestimatedCount: number }
  >
  totalCount: number
  totalValue: number
  unestimatedCount: number
}

interface RecencySummaryResponse {
  byClient: Record<
    string,
    { lastContactAt: string | null; silentDays: number | null; isSilent: boolean }
  >
}

describe("GET /api/clients (integration)", () => {
  it("never returns another user's clients on the default (cached) page", async () => {
    const owner = await makeUser(ctx.prisma)
    await makeClient(ctx.prisma, { userId: owner.id })

    const { GET } = await import("./route")
    const res = await GET(getRequest())
    const body = (await res.json()) as ClientListResponse

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(0)
  })

  it("filters by company/name search and never returns another user's clients (bypass-cache path)", async () => {
    await makeClient(ctx.prisma, {
      userId: currentUser.id,
      company: "Acme Corp",
    })
    await makeClient(ctx.prisma, {
      userId: currentUser.id,
      company: "Other Company",
    })
    const owner = await makeUser(ctx.prisma)
    await makeClient(ctx.prisma, { userId: owner.id, company: "Acme Corp" })

    const { GET } = await import("./route")
    const res = await GET(getRequest("?q=Acme"))
    const body = (await res.json()) as ClientListResponse

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
  })

  it("computes the billable pipeline aggregate from real task rows via the raw SQL join (summary=billable)", async () => {
    const daily = await makeClient(ctx.prisma, {
      userId: currentUser.id,
      billingMode: "DAILY",
      rate: 500,
    })
    const hourly = await makeClient(ctx.prisma, {
      userId: currentUser.id,
      billingMode: "HOURLY",
      rate: 50,
    })
    const fixed = await makeClient(ctx.prisma, {
      userId: currentUser.id,
      billingMode: "FIXED",
      rate: 1000,
    })
    const sideProject = await makeClient(ctx.prisma, {
      userId: currentUser.id,
      category: "SIDE_PROJECT",
    })
    const archived = await makeClient(ctx.prisma, {
      userId: currentUser.id,
      archivedAt: new Date(),
    })

    const dailyProject = await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: daily.id,
    })
    const hourlyProject = await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: hourly.id,
    })
    const fixedProject = await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: fixed.id,
    })
    const sideProjectProject = await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: sideProject.id,
    })
    const archivedProject = await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: archived.id,
    })

    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: daily.id,
      projectId: dailyProject.id,
      estimate: 2,
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: daily.id,
      projectId: dailyProject.id,
      estimate: 3,
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: daily.id,
      projectId: dailyProject.id,
      estimate: null,
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: hourly.id,
      projectId: hourlyProject.id,
      estimate: 2,
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: fixed.id,
      projectId: fixedProject.id,
      estimate: 4,
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: daily.id,
      projectId: dailyProject.id,
      estimate: 100,
      status: "DONE",
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: daily.id,
      projectId: dailyProject.id,
      estimate: 100,
      billable: false,
      nonBillableReason: "OTHER",
      nonBillableNote: "not billed",
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: sideProject.id,
      projectId: sideProjectProject.id,
      estimate: 100,
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: archived.id,
      projectId: archivedProject.id,
      estimate: 100,
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest("?summary=billable"))
    const body = (await res.json()) as BillableSummaryResponse

    expect(res.status).toBe(200)
    expect(body.byClient[daily.id]).toEqual({
      count: 3,
      value: 2500,
      unestimatedCount: 1,
    })
    expect(body.byClient[hourly.id]).toEqual({
      count: 1,
      value: 800,
      unestimatedCount: 0,
    })
    expect(body.byClient[fixed.id]).toEqual({
      count: 1,
      value: 0,
      unestimatedCount: 0,
    })
    expect(body.byClient[sideProject.id]).toBeUndefined()
    expect(body.byClient[archived.id]).toBeUndefined()
    expect(body.totalCount).toBe(5)
    expect(body.totalValue).toBe(3300)
    expect(body.unestimatedCount).toBe(1)
  })

  it("folds the most recent contact across activity/meetings/tasks per client via the UNION ALL (summary=recency)", async () => {
    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000

    const viaTask = await makeClient(ctx.prisma, { userId: currentUser.id })
    const viaTaskProject = await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: viaTask.id,
    })
    await makeActivityLog(ctx.prisma, {
      userId: currentUser.id,
      clientId: viaTask.id,
      createdAt: new Date(now - 10 * DAY),
    })
    await makeMeeting(ctx.prisma, {
      userId: currentUser.id,
      clientId: viaTask.id,
      heldAt: new Date(now - 5 * DAY),
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: viaTask.id,
      projectId: viaTaskProject.id,
      status: "DONE",
      completedAt: new Date(now - 2 * DAY),
    })

    const viaMeeting = await makeClient(ctx.prisma, { userId: currentUser.id })
    await makeMeeting(ctx.prisma, {
      userId: currentUser.id,
      clientId: viaMeeting.id,
      heldAt: new Date(now - 40 * DAY),
    })

    const silent = await makeClient(ctx.prisma, { userId: currentUser.id })

    const { GET } = await import("./route")
    const res = await GET(getRequest("?summary=recency"))
    const body = (await res.json()) as RecencySummaryResponse

    expect(res.status).toBe(200)
    expect(body.byClient[viaTask.id]?.silentDays).toBe(2)
    expect(body.byClient[viaTask.id]?.isSilent).toBe(false)
    expect(body.byClient[viaMeeting.id]?.silentDays).toBe(40)
    expect(body.byClient[viaMeeting.id]?.isSilent).toBe(true)
    expect(body.byClient[silent.id]).toBeUndefined()
  })
})

describe("POST /api/clients (integration)", () => {
  it("creates a client with the submitted fields", async () => {
    const { POST } = await import("./route")
    const res = await POST(
      postRequest({
        firstName: "Jean",
        lastName: "Dupont",
        billingMode: "HOURLY",
        rate: 75,
      }),
    )
    const body = (await res.json()) as { id: string; rate: number }

    expect(res.status).toBe(201)
    expect(body.rate).toBe(75)
    const created = await ctx.prisma.client.findUniqueOrThrow({
      where: { id: body.id },
    })
    expect(created.userId).toBe(currentUser.id)
  })

  it("rejects an invalid email with 400 instead of a 500", async () => {
    const { POST } = await import("./route")
    const res = await POST(
      postRequest({
        firstName: "Jean",
        lastName: "Dupont",
        email: "not-an-email",
      }),
    )

    expect(res.status).toBe(400)
  })

  it("rejects FIXED billing mode without a positive fixedPrice with 400", async () => {
    const { POST } = await import("./route")
    const res = await POST(
      postRequest({
        firstName: "Jean",
        lastName: "Dupont",
        billingMode: "FIXED",
        fixedPrice: 0,
      }),
    )

    expect(res.status).toBe(400)
  })
})
