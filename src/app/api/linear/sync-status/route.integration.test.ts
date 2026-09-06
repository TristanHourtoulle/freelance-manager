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

beforeAll(() => {
  ctx = createIsolatedSchema(
    inject("integrationPostgresUrl"),
    "linear_sync_status",
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

interface SyncStatusResponse {
  status: string
  runId?: string
}

describe("GET /api/linear/sync-status (integration, deprecated alias for /api/task-sync/linear/sync-status)", () => {
  it("authenticates by delegation to getTaskSyncStatus: an unauthenticated call is refused with 401", async () => {
    currentUser = null as unknown as ApiUser
    const { GET } = await import("./route")
    const res = await GET()

    expect(res.status).toBe(401)
  })

  it("returns idle when the caller has no sync run", async () => {
    const { GET } = await import("./route")
    const res = await GET()
    const body = (await res.json()) as SyncStatusResponse

    expect(res.status).toBe(200)
    expect(body.status).toBe("idle")
  })

  it("returns the caller's own latest run, never another user's", async () => {
    const other = await makeUser(ctx.prisma)
    await ctx.prisma.taskSyncRun.create({
      data: {
        userId: other.id,
        providerId: "linear",
        status: "COMPLETED",
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    })
    const mine = await ctx.prisma.taskSyncRun.create({
      data: {
        userId: currentUser.id,
        providerId: "linear",
        status: "RUNNING",
        startedAt: new Date(),
      },
    })

    const { GET } = await import("./route")
    const res = await GET()
    const body = (await res.json()) as SyncStatusResponse

    expect(res.status).toBe(200)
    expect(body.runId).toBe(mine.id)
    expect(body.status).toBe("RUNNING")
  })
})
