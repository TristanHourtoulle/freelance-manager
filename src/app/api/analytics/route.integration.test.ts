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
  makeAnchorCaseInvoice,
  makeClient,
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
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "analytics")
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
  return new Request(`http://localhost/api/analytics${qs}`)
}

interface AnalyticsResponse {
  kpi: { paidCount: number; totalRevenue: number }
  byClient: { client: { id: string }; revenue: number }[]
}

describe("GET /api/analytics (integration)", () => {
  /**
   * TRI-1218 regression: `monthBuckets` used to be built from a
   * locally-constructed `Date` (`new Date(y, m, 1)`) read back through a UTC
   * ISO string, which shifted every bucket's key back a month under a
   * positive server UTC offset (this sandbox runs at UTC+2) — the current
   * month's payments (here, the anchor case's final two, 2026-09-02 and
   * 2026-09-04) never landed in `totalRevenue`. `buildMonthlyBuckets`
   * (`@/domain/analytics/month-buckets`) now derives every boundary from the
   * UTC calendar, so `kpi.totalRevenue` is asserted here alongside
   * `byClient[].revenue` (which sums `payments` with no date-bucketing and
   * was never affected).
   */
  it("counts the anchor case's five settling payments as per-client revenue for a fully paid invoice", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    await makeAnchorCaseInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest())
    const body = (await res.json()) as AnalyticsResponse

    expect(res.status).toBe(200)
    expect(body.kpi.paidCount).toBe(1)
    expect(body.byClient[0]?.revenue).toBeCloseTo(5504.94, 2)
    expect(body.kpi.totalRevenue).toBeCloseTo(5504.94, 2)
  })

  it("never mixes another user's invoices into the current user's analytics", async () => {
    const other = await makeUser(ctx.prisma)
    const otherClient = await makeClient(ctx.prisma, { userId: other.id })
    await makeAnchorCaseInvoice(ctx.prisma, {
      userId: other.id,
      clientId: otherClient.id,
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest())
    const body = (await res.json()) as AnalyticsResponse

    expect(res.status).toBe(200)
    expect(body.kpi.paidCount).toBe(0)
    expect(body.kpi.totalRevenue).toBe(0)
    expect(body.byClient).toHaveLength(0)
  })
})
