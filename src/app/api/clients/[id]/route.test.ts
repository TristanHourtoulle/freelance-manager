import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock, queryRaw } = vi.hoisted(() => ({
  prismaMock: {
    client: { findFirst: vi.fn() },
    task: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
    meeting: { findMany: vi.fn() },
    clientAction: { findMany: vi.fn(), findFirst: vi.fn() },
    userSettings: { findUnique: vi.fn() },
  },
  queryRaw: vi.fn(),
}))
vi.mock("@/lib/db", () => ({
  prisma: {
    ...prismaMock,
    $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) =>
      queryRaw(strings, ...values),
  },
}))

const getAuthUser = vi.fn()
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getAuthUser: () => getAuthUser() }
})
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))

const USER_ID = "user-1"
const CLIENT_ID = "client-1"

function client() {
  return {
    id: CLIENT_ID,
    firstName: "Henri",
    lastName: "Mistral",
    company: "Mistral SAS",
    email: null,
    phone: null,
    website: null,
    address: null,
    notes: null,
    billingMode: "DAILY",
    rate: 500,
    fixedPrice: null,
    deposit: null,
    paymentTerms: null,
    category: "FREELANCE",
    color: null,
    starred: false,
    archivedAt: null,
    createdAt: new Date("2026-01-01"),
    projects: [],
    linearMappings: [],
  }
}

function lateInvoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-late",
    number: "2026-1001",
    status: "SENT",
    paymentStatus: "UNPAID",
    kind: "STANDARD",
    issueDate: new Date("2026-07-01"),
    dueDate: new Date("2026-08-01"),
    total: 1000,
    lateFeeFixed: 0,
    lateFeeInterest: 0,
    lateFeeClaimedAt: null,
    lateFeeWaived: false,
    _count: { lines: 1 },
    payments: [],
    ...overrides,
  }
}

function request() {
  return new Request(`http://localhost/api/clients/${CLIENT_ID}`)
}

const routeParams = { params: Promise.resolve({ id: CLIENT_ID }) }

describe("GET /api/clients/[id] — late-fee policy threading", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-04T00:00:00.000Z"))

    getAuthUser.mockResolvedValue({ id: USER_ID })
    prismaMock.client.findFirst.mockResolvedValue(client())
    prismaMock.task.findMany.mockResolvedValue([])
    prismaMock.invoice.findMany.mockResolvedValue([lateInvoiceRow()])
    prismaMock.meeting.findMany.mockResolvedValue([])
    prismaMock.clientAction.findMany.mockResolvedValue([])
    prismaMock.clientAction.findFirst.mockResolvedValue(null)
    queryRaw.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("computes the client-detail penalty KPI from the real UserSettings rate, not the hardcoded default", async () => {
    prismaMock.userSettings.findUnique.mockResolvedValue({
      lateFeeFixedAmount: 40,
      lateFeeAnnualRate: 0.12,
    })

    const { GET } = await import("./route")
    const res = await GET(request(), routeParams)
    const body = (await res.json()) as {
      invoices: { lateFeeAccrued: number }[]
    }

    expect(res.status).toBe(200)
    expect(body.invoices[0]?.lateFeeAccrued).toBe(51.18)
  })

  it("falls back to the shared default policy when the user has no settings row yet", async () => {
    prismaMock.userSettings.findUnique.mockResolvedValue(null)

    const { GET } = await import("./route")
    const res = await GET(request(), routeParams)
    const body = (await res.json()) as {
      invoices: { lateFeeAccrued: number }[]
    }

    expect(body.invoices[0]?.lateFeeAccrued).toBe(49.32)
  })
})
