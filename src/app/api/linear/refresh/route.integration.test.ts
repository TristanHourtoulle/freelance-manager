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
let afterCallback: (() => Promise<void>) | null = null

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

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>(
    "next/server",
  )
  return {
    ...actual,
    after: (cb: () => Promise<void>) => {
      afterCallback = cb
    },
  }
})

const { runTaskSyncMock } = vi.hoisted(() => ({
  runTaskSyncMock: vi.fn(),
}))
vi.mock("@/lib/task-sync/run", () => ({
  runTaskSync: (...args: unknown[]) => runTaskSyncMock(...args),
}))

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "linear_refresh")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
  afterCallback = null
  runTaskSyncMock.mockReset()
  runTaskSyncMock.mockResolvedValue({ tasks: 0, projects: 0 })
})

function postRequest(): Request {
  return new Request("http://localhost/api/linear/refresh", { method: "POST" })
}

describe("POST /api/linear/refresh (integration, deprecated alias for /api/task-sync/linear/refresh)", () => {
  it("authenticates by delegation to startTaskSync: an unauthenticated call is refused with 401", async () => {
    currentUser = null as unknown as ApiUser
    const { POST } = await import("./route")
    const res = await POST(postRequest())

    expect(res.status).toBe(401)
    expect(afterCallback).toBeNull()
    const runCount = await ctx.prisma.taskSyncRun.count()
    expect(runCount).toBe(0)
  })

  it("starts a real, userId-scoped sync run in the database for an authenticated caller", async () => {
    const { POST } = await import("./route")
    const res = await POST(postRequest())
    const body = (await res.json()) as { status: string; runId: string }

    expect(res.status).toBe(202)
    expect(body.status).toBe("started")

    const run = await ctx.prisma.taskSyncRun.findUniqueOrThrow({
      where: { id: body.runId },
    })
    expect(run.userId).toBe(currentUser.id)
    expect(run.providerId).toBe("linear")
    expect(afterCallback).toBeTypeOf("function")
    expect(runTaskSyncMock).not.toHaveBeenCalled()
  })

  it("never lets a second concurrent request for the same user start a second run", async () => {
    const { POST } = await import("./route")
    const first = await POST(postRequest())
    expect(first.status).toBe(202)

    const second = await POST(postRequest())
    expect(second.status).toBe(409)

    const runCount = await ctx.prisma.taskSyncRun.count({
      where: { userId: currentUser.id },
    })
    expect(runCount).toBe(1)
  })

  it("scopes the running-run check to the session user: another user's own request is unaffected", async () => {
    const { POST } = await import("./route")
    const first = await POST(postRequest())
    expect(first.status).toBe(202)

    const other = await makeUser(ctx.prisma)
    currentUser = other
    const second = await POST(postRequest())

    expect(second.status).toBe(202)
    const runCount = await ctx.prisma.taskSyncRun.count()
    expect(runCount).toBe(2)
  })
})
