import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@/generated/prisma/client"

const invoiceFindMany = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    invoice: { findMany: (...args: unknown[]) => invoiceFindMany(...args) },
  },
}))
vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

const { getInvoicesFirstPage, findInvoicesFirstPageRows } =
  await import("./invoices")

function euros(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value)
}

/**
 * A row shaped exactly like what `prisma.invoice.findMany` returns: every
 * money column is a live `Prisma.Decimal` instance, not a plain number.
 * Regression fixture for the "Decimal crosses the `use cache` boundary"
 * bug — see the `findInvoicesFirstPageRows` describe block below.
 */
function rawPrismaInvoiceRow() {
  return {
    id: "inv-1",
    number: "2026-1001",
    clientId: "client-1",
    projectId: null,
    status: "SENT" as const,
    paymentStatus: "UNPAID" as const,
    kind: "STANDARD" as const,
    issueDate: new Date("2026-07-01"),
    dueDate: new Date("2026-08-01"),
    subtotal: euros(1000),
    tax: euros(0),
    total: euros(1000),
    totalOverride: null,
    notes: null,
    lateFeeFixed: euros(0),
    lateFeeInterest: euros(0),
    lateFeeClaimedAt: null,
    lateFeeWaived: false,
    _count: { lines: 1 },
    payments: [
      { amount: euros(200), paidAt: new Date("2026-07-15"), penaltyAmount: euros(5) },
    ],
  }
}

function invoiceRow() {
  return {
    id: "inv-1",
    number: "2026-1001",
    clientId: "client-1",
    projectId: null,
    status: "SENT" as const,
    paymentStatus: "UNPAID" as const,
    kind: "STANDARD" as const,
    issueDate: new Date("2026-07-01"),
    dueDate: new Date("2026-08-01"),
    subtotal: 1000,
    tax: 0,
    total: 1000,
    totalOverride: null,
    notes: null,
    lateFeeFixed: 0,
    lateFeeInterest: 0,
    lateFeeClaimedAt: null,
    lateFeeWaived: false,
    _count: { lines: 1 },
    payments: [],
  }
}

describe("getInvoicesFirstPage", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-04T00:00:00.000Z"))
    invoiceFindMany.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("computes lateFeeAccrued with the caller's real policy, not the hardcoded default", async () => {
    invoiceFindMany.mockResolvedValue([invoiceRow()])

    const nonDefault = await getInvoicesFirstPage("user-1", {
      fixedAmount: 40,
      annualRate: 0.12,
    })
    const defaultPolicy = await getInvoicesFirstPage("user-1", {
      fixedAmount: 40,
      annualRate: 0.1,
    })

    expect(nonDefault.data[0]?.lateFeeAccrued).toBe(51.18)
    expect(defaultPolicy.data[0]?.lateFeeAccrued).toBe(49.32)
    expect(nonDefault.data[0]?.lateFeeAccrued).not.toBe(
      defaultPolicy.data[0]?.lateFeeAccrued,
    )
  })
})

/**
 * True when any value reachable from `value` is a live `Prisma.Decimal`
 * instance. A `"use cache"` function must never let one reach its return
 * value: Next's cache boundary serializes that value and strips the
 * `Decimal` prototype on the way out, so a `Decimal` left in the tree comes
 * back on the other side as a plain object with no `.toNumber()` — the
 * exact shape of the `d.toNumber is not a function` regression this guards
 * against.
 */
function containsDecimalInstance(value: unknown): boolean {
  if (value instanceof Prisma.Decimal) return true
  if (value instanceof Date) return false
  if (Array.isArray(value)) return value.some(containsDecimalInstance)
  if (value != null && typeof value === "object") {
    return Object.values(value).some(containsDecimalInstance)
  }
  return false
}

describe("findInvoicesFirstPageRows", () => {
  beforeEach(() => {
    invoiceFindMany.mockReset()
  })

  it("converts every Prisma.Decimal column to a plain number before returning, so the row is safe to cross the `use cache` boundary", async () => {
    invoiceFindMany.mockResolvedValue([rawPrismaInvoiceRow()])

    const [row] = await findInvoicesFirstPageRows("user-1")

    expect(row).toBeDefined()
    expect(containsDecimalInstance(row)).toBe(false)
    expect(typeof row?.subtotal).toBe("number")
    expect(typeof row?.tax).toBe("number")
    expect(typeof row?.total).toBe("number")
    expect(typeof row?.lateFeeFixed).toBe("number")
    expect(typeof row?.lateFeeInterest).toBe("number")
    expect(typeof row?.payments[0]?.amount).toBe("number")
    expect(typeof row?.payments[0]?.penaltyAmount).toBe("number")
    expect(row?.total).toBe(1000)
    expect(row?.payments[0]?.amount).toBe(200)
    expect(row?.payments[0]?.penaltyAmount).toBe(5)
  })

  it("preserves null on an unset totalOverride rather than coercing it to 0", async () => {
    invoiceFindMany.mockResolvedValue([rawPrismaInvoiceRow()])

    const [row] = await findInvoicesFirstPageRows("user-1")

    expect(row?.totalOverride).toBeNull()
  })
})
