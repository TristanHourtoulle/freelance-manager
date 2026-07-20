import { describe, expect, it, vi } from "vitest"
import type { Prisma } from "@/generated/prisma/client"
import { nextQuoteNumber } from "./quote-numbering"
import { nextAutoNumber } from "./invoice-numbering"

type TxClient = Prisma.TransactionClient

type FakeTxOptions = {
  count: number
  taken?: readonly string[]
}

type FakeTx = {
  tx: TxClient
  lockKeys: bigint[]
  findManyWhere: unknown[]
  callOrder: string[]
  invoiceFindMany: ReturnType<typeof vi.fn>
  invoiceCount: ReturnType<typeof vi.fn>
}

function createFakeTx({ count, taken = [] }: FakeTxOptions): FakeTx {
  const lockKeys: bigint[] = []
  const findManyWhere: unknown[] = []
  const callOrder: string[] = []
  const invoiceFindMany = vi.fn(() => Promise.resolve([]))
  const invoiceCount = vi.fn(() => Promise.resolve(0))

  const tx = {
    $executeRaw: (_strings: TemplateStringsArray, ...values: unknown[]) => {
      callOrder.push("lock")
      lockKeys.push(values[0] as bigint)
      return Promise.resolve(1)
    },
    quote: {
      findMany: (args: { where: unknown }) => {
        callOrder.push("findMany")
        findManyWhere.push(args.where)
        return Promise.resolve(taken.map((number) => ({ number })))
      },
      count: () => {
        callOrder.push("count")
        return Promise.resolve(count)
      },
    },
    invoice: {
      findMany: invoiceFindMany,
      count: invoiceCount,
    },
  }

  return {
    tx: tx as unknown as TxClient,
    lockKeys,
    findManyWhere,
    callOrder,
    invoiceFindMany,
    invoiceCount,
  }
}

describe("nextQuoteNumber", () => {
  it("allocates D-2026-0001 when the user has no quote yet", async () => {
    const { tx } = createFakeTx({ count: 0 })

    await expect(nextQuoteNumber(tx, "user_alpha", 2026)).resolves.toBe(
      "D-2026-0001",
    )
  })

  it("prefixes the sequence with the requested year", async () => {
    const { tx } = createFakeTx({ count: 4 })

    await expect(nextQuoteNumber(tx, "user_alpha", 2031)).resolves.toBe(
      "D-2031-0005",
    )
  })

  it("skips a number already taken by a custom quote number", async () => {
    const { tx } = createFakeTx({ count: 2, taken: ["D-2026-0003"] })

    await expect(nextQuoteNumber(tx, "user_alpha", 2026)).resolves.toBe(
      "D-2026-0004",
    )
  })

  it("only loads numbers belonging to the requested year", async () => {
    const { tx, findManyWhere } = createFakeTx({ count: 0 })

    await nextQuoteNumber(tx, "user_alpha", 2026)

    expect(findManyWhere[0]).toEqual({
      userId: "user_alpha",
      number: { startsWith: "D-2026-" },
    })
  })

  it("acquires the advisory lock before reading", async () => {
    const { tx, callOrder } = createFakeTx({ count: 0 })

    await nextQuoteNumber(tx, "user_alpha", 2026)

    expect(callOrder[0]).toBe("lock")
    expect(callOrder).toContain("findMany")
    expect(callOrder).toContain("count")
  })

  it("uses a different advisory lock key than invoice numbering", async () => {
    const quoteTx = createFakeTx({ count: 0 })
    await nextQuoteNumber(quoteTx.tx, "user_alpha", 2026)

    const invoiceLockKeys: bigint[] = []
    const invoiceTx = {
      $executeRaw: (_s: TemplateStringsArray, ...values: unknown[]) => {
        invoiceLockKeys.push(values[0] as bigint)
        return Promise.resolve(1)
      },
      invoice: {
        findMany: () => Promise.resolve([]),
        count: () => Promise.resolve(0),
      },
    } as unknown as TxClient
    await nextAutoNumber(invoiceTx, "user_alpha", 2026)

    expect(quoteTx.lockKeys).toHaveLength(1)
    expect(invoiceLockKeys).toHaveLength(1)
    expect(quoteTx.lockKeys[0]).not.toBe(invoiceLockKeys[0])
  })

  it("never reads the invoice table while allocating a quote number", async () => {
    const { tx, invoiceFindMany, invoiceCount } = createFakeTx({
      count: 1024,
      taken: [],
    })

    const number = await nextQuoteNumber(tx, "user_alpha", 2026)

    expect(number).toBe("D-2026-1025")
    expect(number.startsWith("D-")).toBe(true)
    expect(invoiceFindMany).not.toHaveBeenCalled()
    expect(invoiceCount).not.toHaveBeenCalled()
  })
})
