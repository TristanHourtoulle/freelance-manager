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
  makeInvoice,
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
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "invoice_id")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function getRequest(invoiceId: string): Request {
  return new Request(`http://localhost/api/invoices/${invoiceId}`)
}

function patchRequest(
  invoiceId: string,
  body: Record<string, unknown>,
): Request {
  return new Request(`http://localhost/api/invoices/${invoiceId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function deleteRequest(invoiceId: string): Request {
  return new Request(`http://localhost/api/invoices/${invoiceId}`, {
    method: "DELETE",
  })
}

interface InvoiceDetailResponse {
  id: string
  balanceDue: number
  lateFeeDue: number
  lateFeeAccrued: number
  paymentStatus: string
  isOverdue: boolean
}

describe("GET /api/invoices/[id] (integration)", () => {
  it("matches the anchor case exactly: 5460 total, five payments, 44.94 claimed of 58.69 accrued", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const { invoice } = await makeAnchorCaseInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest(invoice.id), {
      params: Promise.resolve({ id: invoice.id }),
    })
    const body = (await res.json()) as InvoiceDetailResponse

    expect(res.status).toBe(200)
    expect(body.balanceDue).toBe(0)
    expect(body.lateFeeDue).toBe(44.94)
    expect(body.lateFeeAccrued).toBe(58.69)
    expect(body.paymentStatus).toBe("PAID")
    expect(body.isOverdue).toBe(false)
  })

  it("returns a non-zero balanceDue/lateFeeDue for a claimed, unpaid penalty (select-completeness)", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const { invoice } = await makeInvoiceWithClaimedLateFee(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest(invoice.id), {
      params: Promise.resolve({ id: invoice.id }),
    })
    const body = (await res.json()) as InvoiceDetailResponse

    expect(res.status).toBe(200)
    expect(body.lateFeeDue).toBe(45)
    expect(body.balanceDue).toBe(45)
    expect(body.isOverdue).toBe(true)
  })

  it("honours a configured non-default late-fee annual rate rather than the 10% default", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const dueDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
    const issueDate = new Date(dueDate.getTime() - 10 * 24 * 60 * 60 * 1000)
    const invoice = await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      status: "SENT",
      total: 10_000,
      issueDate,
      dueDate,
    })

    const { GET } = await import("./route")
    const withoutSettings = (await (
      await GET(getRequest(invoice.id), {
        params: Promise.resolve({ id: invoice.id }),
      })
    ).json()) as InvoiceDetailResponse

    await makeUserSettings(ctx.prisma, {
      userId: currentUser.id,
      lateFeeAnnualRate: 0.12,
      lateFeeFixedAmount: 40,
    })
    const withSettings = (await (
      await GET(getRequest(invoice.id), {
        params: Promise.resolve({ id: invoice.id }),
      })
    ).json()) as InvoiceDetailResponse

    expect(withoutSettings.lateFeeAccrued).toBeGreaterThan(0)
    expect(withSettings.lateFeeAccrued).toBeGreaterThan(
      withoutSettings.lateFeeAccrued,
    )
  })

  it("returns 404 (never 200) for another user's invoice", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest(invoice.id), {
      params: Promise.resolve({ id: invoice.id }),
    })

    expect(res.status).toBe(404)
  })
})

describe("PATCH /api/invoices/[id] (integration)", () => {
  it("rejects an invalid status-only payload with 400", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest(invoice.id, { status: "NOT_A_STATUS" }),
      {
        params: Promise.resolve({ id: invoice.id }),
      },
    )

    expect(res.status).toBe(400)
  })

  it("returns 404 (never 200) when patching another user's invoice", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
    })

    const { PATCH } = await import("./route")
    const res = await PATCH(patchRequest(invoice.id, { status: "CANCELLED" }), {
      params: Promise.resolve({ id: invoice.id }),
    })

    expect(res.status).toBe(404)

    const untouched = await ctx.prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      select: { status: true },
    })
    expect(untouched.status).toBe("SENT")
  })
})

describe("DELETE /api/invoices/[id] (integration)", () => {
  it("deletes the caller's own invoice", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(invoice.id), {
      params: Promise.resolve({ id: invoice.id }),
    })

    expect(res.status).toBe(200)
    const remaining = await ctx.prisma.invoice.findUnique({
      where: { id: invoice.id },
    })
    expect(remaining).toBeNull()
  })

  /**
   * Documents an actual, current gap rather than the ticket's expected
   * `404` contract: `DELETE` scopes its write with
   * `prisma.invoice.deleteMany({ where: { id, userId } })` instead of a
   * `findFirst` existence check first (unlike this same route's `GET` and
   * `PATCH`, and unlike `DELETE /api/clients/[id]` and
   * `DELETE /api/quotes/[id]`). A `deleteMany` matching zero rows is not an
   * error, so calling `DELETE` on another user's invoice responds `200 {
   * ok: true }` — identical to deleting an id that never existed at all —
   * rather than `404`. No data is leaked or mutated (the assertion below
   * pins that), but the response code diverges from every sibling
   * ownership-scoped route. Filed as a finding rather than silently
   * patched, per this ticket's constraint against changing production code.
   */
  it("responds 200 without deleting when the invoice belongs to another user (known scoping gap, see JSDoc)", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
    })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(invoice.id), {
      params: Promise.resolve({ id: invoice.id }),
    })

    expect(res.status).toBe(200)
    const untouched = await ctx.prisma.invoice.findUnique({
      where: { id: invoice.id },
    })
    expect(untouched).not.toBeNull()
  })
})
