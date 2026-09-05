import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    invoice: { findUnique: vi.fn() },
    userSettings: { findUnique: vi.fn() },
    clientAction: { findUnique: vi.fn(), create: vi.fn() },
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

const getAuthUser = vi.fn()
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getAuthUser: () => getAuthUser() }
})

const INVOICE_ID = "inv-1"
const USER_ID = "user-1"
const NOW = new Date(2026, 2, 1, 12, 0, 0)
const PAST_DUE = new Date(2026, 0, 1)
const PAID_AT = new Date(2026, 0, 5)
const CLAIMED_AT = new Date(2026, 0, 15)

function postRequest() {
  return new Request(`http://localhost/api/invoices/${INVOICE_ID}/relance`, {
    method: "POST",
  })
}

const routeParams = { params: Promise.resolve({ id: INVOICE_ID }) }

interface RelanceResponseBody {
  action: { id: string } | null
  created: boolean
  settled: boolean
}

describe("POST /api/invoices/[id]/relance", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_APP_URL
    vi.useFakeTimers()
    vi.setSystemTime(NOW)

    getAuthUser.mockResolvedValue({ id: USER_ID })
    prismaMock.userSettings.findUnique.mockResolvedValue({
      lateFeeFixedAmount: 40,
      lateFeeAnnualRate: 0,
    })
    prismaMock.clientAction.findUnique.mockResolvedValue(null)
    prismaMock.clientAction.create.mockResolvedValue({
      id: "action-1",
      clientId: "client-1",
      client: null,
      invoice: { number: "2026-0001" },
      type: "RELANCE",
      title: "Relancer la facture 2026-0001",
      link: null,
      notes: null,
      status: "TODO",
      dueDate: NOW,
      doneAt: null,
      invoiceId: INVOICE_ID,
      meetingId: null,
      createdAt: NOW,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("creates a relance for an invoice whose principal is paid but whose claimed penalty is unpaid", async () => {
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: INVOICE_ID,
      userId: USER_ID,
      clientId: "client-1",
      number: "2026-0001",
      status: "SENT",
      paymentStatus: "PARTIALLY_PAID",
      total: 1000,
      dueDate: PAST_DUE,
      lateFeeFixed: 40,
      lateFeeInterest: 0,
      lateFeeClaimedAt: CLAIMED_AT,
      lateFeeWaived: false,
      payments: [{ amount: 1000, paidAt: PAID_AT, penaltyAmount: 0 }],
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest(), routeParams)
    const body = (await res.json()) as RelanceResponseBody

    expect(res.status).toBe(200)
    expect(body.settled).toBe(false)
    expect(body.created).toBe(true)
    expect(body.action).not.toBeNull()
    expect(prismaMock.clientAction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceId: INVOICE_ID,
          relanceInvoiceId: INVOICE_ID,
        }),
      }),
    )
  })

  it("reports settled with no relance when principal and any claimed penalty are both paid off", async () => {
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: INVOICE_ID,
      userId: USER_ID,
      clientId: "client-1",
      number: "2026-0001",
      status: "SENT",
      paymentStatus: "PAID",
      total: 1000,
      dueDate: PAST_DUE,
      lateFeeFixed: 0,
      lateFeeInterest: 0,
      lateFeeClaimedAt: null,
      lateFeeWaived: false,
      payments: [{ amount: 1000, paidAt: PAID_AT, penaltyAmount: 0 }],
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest(), routeParams)
    const body = (await res.json()) as RelanceResponseBody

    expect(res.status).toBe(200)
    expect(body.settled).toBe(true)
    expect(body.created).toBe(false)
    expect(body.action).toBeNull()
    expect(prismaMock.clientAction.create).not.toHaveBeenCalled()
  })

  it("returns the existing action without creating a duplicate", async () => {
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: INVOICE_ID,
      userId: USER_ID,
      clientId: "client-1",
      number: "2026-0001",
      status: "SENT",
      paymentStatus: "UNPAID",
      total: 1000,
      dueDate: PAST_DUE,
      lateFeeFixed: 0,
      lateFeeInterest: 0,
      lateFeeClaimedAt: null,
      lateFeeWaived: false,
      payments: [],
    })
    prismaMock.clientAction.findUnique.mockResolvedValue({
      id: "action-existing",
      clientId: "client-1",
      client: null,
      invoice: { number: "2026-0001" },
      type: "RELANCE",
      title: "Relancer la facture 2026-0001",
      link: null,
      notes: null,
      status: "TODO",
      dueDate: NOW,
      doneAt: null,
      invoiceId: INVOICE_ID,
      meetingId: null,
      createdAt: NOW,
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest(), routeParams)
    const body = (await res.json()) as RelanceResponseBody

    expect(res.status).toBe(200)
    expect(body.created).toBe(false)
    expect(body.settled).toBe(false)
    expect(body.action?.id).toBe("action-existing")
    expect(prismaMock.clientAction.create).not.toHaveBeenCalled()
  })

  it("returns 404 for an invoice belonging to another user", async () => {
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: INVOICE_ID,
      userId: "someone-else",
      clientId: "client-1",
      number: "2026-0001",
      status: "SENT",
      paymentStatus: "UNPAID",
      total: 1000,
      dueDate: PAST_DUE,
      lateFeeFixed: 0,
      lateFeeInterest: 0,
      lateFeeClaimedAt: null,
      lateFeeWaived: false,
      payments: [],
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest(), routeParams)

    expect(res.status).toBe(404)
    expect(prismaMock.clientAction.create).not.toHaveBeenCalled()
  })

  it("returns 401 when unauthenticated", async () => {
    getAuthUser.mockResolvedValue(null)

    const { POST } = await import("./route")
    const res = await POST(postRequest(), routeParams)

    expect(res.status).toBe(401)
  })
})
