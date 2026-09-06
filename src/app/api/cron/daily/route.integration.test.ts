import {
  afterAll,
  afterEach,
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
} from "@/test/integration/factories"

let ctx: IsolatedSchema
const SECRET = "test-cron-secret-value"

vi.mock("@/lib/db", () => ({
  get prisma() {
    return ctx.prisma
  },
}))

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "cron_daily")
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

let previousSecret: string | undefined

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  previousSecret = process.env.CRON_SECRET
  process.env.CRON_SECRET = SECRET
})

afterEach(() => {
  if (previousSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = previousSecret
})

function postRequest(key?: string): Request {
  return new Request("http://localhost/api/cron/daily", {
    method: "POST",
    headers: key === undefined ? {} : { "X-Cron-Key": key },
  })
}

interface DailyRunResponse {
  jobs: { name: string; ok: boolean; count: number }[]
}

describe("POST /api/cron/daily (integration)", () => {
  it("rejects a wrong key with 401 without touching the database", async () => {
    const { POST } = await import("./route")
    const res = await POST(postRequest("wrong-key"))

    expect(res.status).toBe(401)
  })

  it("returns 503 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET

    const { POST } = await import("./route")
    const res = await POST(postRequest(SECRET))

    expect(res.status).toBe(503)
  })

  it("sweeps overdue invoices for every user, not just the first one", async () => {
    const { makeUser } = await import("@/test/integration/factories")
    const userA = await makeUser(ctx.prisma)
    const userB = await makeUser(ctx.prisma)
    const clientA = await makeClient(ctx.prisma, { userId: userA.id })
    const clientB = await makeClient(ctx.prisma, { userId: userB.id })
    const { invoice: invoiceA } = await makeInvoiceWithClaimedLateFee(
      ctx.prisma,
      { userId: userA.id, clientId: clientA.id },
    )
    const { invoice: invoiceB } = await makeInvoiceWithClaimedLateFee(
      ctx.prisma,
      { userId: userB.id, clientId: clientB.id },
    )

    const { POST } = await import("./route")
    const res = await POST(postRequest(SECRET))
    const body = (await res.json()) as DailyRunResponse

    expect(res.status).toBe(200)
    const relanceJob = body.jobs.find((j) => j.name === "overdue-relances")
    expect(relanceJob?.ok).toBe(true)
    expect(relanceJob?.count).toBe(2)

    const actions = await ctx.prisma.clientAction.findMany({
      where: { invoiceId: { in: [invoiceA.id, invoiceB.id] }, type: "RELANCE" },
    })
    expect(actions).toHaveLength(2)
    const relancedUserIds = new Set(actions.map((a) => a.userId))
    expect(relancedUserIds).toEqual(new Set([userA.id, userB.id]))
  })
})
