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
  makeInvoiceWithClaimedLateFee,
  makeUser,
  makeUserSettings,
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
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "dashboard")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

interface DashboardResponse {
  kpi: {
    outstanding: number
    overdueAmount: number
    overdueCount: number
    lateFeeAccrued: number
  }
  overdue: { id: string; total: number }[]
}

describe("GET /api/dashboard (integration)", () => {
  it("folds a claimed, unpaid penalty into overdueAmount and lateFeeAccrued (select-completeness)", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    await makeInvoiceWithClaimedLateFee(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { GET } = await import("./route")
    const res = await GET()
    const body = (await res.json()) as DashboardResponse

    expect(res.status).toBe(200)
    expect(body.kpi.overdueCount).toBe(1)
    expect(body.kpi.overdueAmount).toBe(45)
    expect(body.kpi.outstanding).toBe(45)
    expect(body.kpi.lateFeeAccrued).toBeGreaterThan(0)
  })

  it("also queues a relance for the overdue invoice it just read", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const { invoice } = await makeInvoiceWithClaimedLateFee(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { GET } = await import("./route")
    await GET()

    const actions = await ctx.prisma.clientAction.findMany({
      where: { invoiceId: invoice.id, type: "RELANCE" },
    })
    expect(actions).toHaveLength(1)
  })

  it("honours a configured non-default late-fee annual rate rather than the 10% default", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    await makeInvoiceWithClaimedLateFee(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { GET } = await import("./route")
    const before = (await (await GET()).json()) as DashboardResponse

    await makeUserSettings(ctx.prisma, {
      userId: currentUser.id,
      lateFeeAnnualRate: 0.4,
      lateFeeFixedAmount: 40,
    })
    const after = (await (await GET()).json()) as DashboardResponse

    expect(after.kpi.lateFeeAccrued).toBeGreaterThan(before.kpi.lateFeeAccrued)
  })

  it("never mixes another user's invoices into the current user's KPIs", async () => {
    const other = await makeUser(ctx.prisma)
    const otherClient = await makeClient(ctx.prisma, { userId: other.id })
    await makeInvoiceWithClaimedLateFee(ctx.prisma, {
      userId: other.id,
      clientId: otherClient.id,
    })

    const { GET } = await import("./route")
    const res = await GET()
    const body = (await res.json()) as DashboardResponse

    expect(res.status).toBe(200)
    expect(body.kpi.overdueCount).toBe(0)
    expect(body.kpi.outstanding).toBe(0)
    expect(body.overdue).toHaveLength(0)
  })
})
