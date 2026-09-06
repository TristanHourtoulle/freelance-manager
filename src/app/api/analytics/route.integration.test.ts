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
   * `kpi.totalRevenue` is deliberately not asserted here: it is derived from
   * `monthBuckets`, whose lookup keys are built by converting a
   * locally-constructed `Date` to a UTC ISO string
   * (`route.ts`'s `monthBuckets.push({ ... paid: paidByMonthMap.get(key) })`
   * with `key = start.toISOString().slice(0, 7)`). In any server timezone
   * with a positive UTC offset (this sandbox runs at UTC+2), that shifts
   * every bucket's key back by one calendar month, and the current month's
   * true bucket key is never produced by the loop — so payments dated in
   * the current month (here, the anchor case's final two, 2026-09-02 and
   * 2026-09-04) never reach `totalRevenue`. This is a real, pre-existing
   * bug independent of the late-fee feature this ticket covers; flagged in
   * the PR description rather than fixed here (out of scope, and
   * production code is otherwise left untouched by this ticket).
   * `byClient[].revenue` is unaffected — it sums `payments` with no
   * date-bucketing — so it is what this test asserts instead.
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
