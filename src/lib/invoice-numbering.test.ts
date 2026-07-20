import { describe, expect, it } from "vitest"
import type { Prisma } from "@/generated/prisma/client"
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
}

function createFakeTx({ count, taken = [] }: FakeTxOptions): FakeTx {
  const lockKeys: bigint[] = []
  const findManyWhere: unknown[] = []
  const callOrder: string[] = []

  const tx = {
    $executeRaw: (_strings: TemplateStringsArray, ...values: unknown[]) => {
      callOrder.push("lock")
      lockKeys.push(values[0] as bigint)
      return Promise.resolve(1)
    },
    invoice: {
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
  }

  return {
    tx: tx as unknown as TxClient,
    lockKeys,
    findManyWhere,
    callOrder,
  }
}

describe("nextAutoNumber", () => {
  describe("format and base offset", () => {
    it("starts the sequence at 1025 when the user has no invoice yet", async () => {
      const { tx } = createFakeTx({ count: 0 })

      await expect(nextAutoNumber(tx, "user_alpha", 2026)).resolves.toBe(
        "2026-1025",
      )
    })

    it("offsets the sequence by the total invoice count plus 1025", async () => {
      const { tx } = createFakeTx({ count: 7 })

      await expect(nextAutoNumber(tx, "user_alpha", 2026)).resolves.toBe(
        "2026-1032",
      )
    })

    it("prefixes the number with the requested year", async () => {
      const { tx } = createFakeTx({ count: 0 })

      await expect(nextAutoNumber(tx, "user_alpha", 2031)).resolves.toBe(
        "2031-1025",
      )
    })

    it("keeps four-digit zero padding at the top of the four-digit range", async () => {
      const { tx } = createFakeTx({ count: 8974 })

      await expect(nextAutoNumber(tx, "user_alpha", 2026)).resolves.toBe(
        "2026-9999",
      )
    })

    it("grows to five digits when the sequence crosses the four-digit width", async () => {
      const { tx } = createFakeTx({ count: 8975 })

      await expect(nextAutoNumber(tx, "user_alpha", 2026)).resolves.toBe(
        "2026-10000",
      )
    })

    it("grows past five digits without truncating the sequence", async () => {
      const { tx } = createFakeTx({ count: 98975 })

      await expect(nextAutoNumber(tx, "user_alpha", 2026)).resolves.toBe(
        "2026-100000",
      )
    })
  })

  describe("gap skipping", () => {
    it("walks forward one step when the first candidate is taken", async () => {
      const { tx } = createFakeTx({ count: 0, taken: ["2026-1025"] })

      await expect(nextAutoNumber(tx, "user_alpha", 2026)).resolves.toBe(
        "2026-1026",
      )
    })

    it("walks past a run of consecutive taken numbers", async () => {
      const { tx } = createFakeTx({
        count: 0,
        taken: ["2026-1025", "2026-1026", "2026-1027", "2026-1028"],
      })

      await expect(nextAutoNumber(tx, "user_alpha", 2026)).resolves.toBe(
        "2026-1029",
      )
    })

    it("stops at the first free number instead of the last taken one", async () => {
      const { tx } = createFakeTx({
        count: 0,
        taken: ["2026-1025", "2026-1027", "2026-1028"],
      })

      await expect(nextAutoNumber(tx, "user_alpha", 2026)).resolves.toBe(
        "2026-1026",
      )
    })

    it("ignores taken numbers that are ahead of the candidate", async () => {
      const { tx } = createFakeTx({ count: 0, taken: ["2026-2000"] })

      await expect(nextAutoNumber(tx, "user_alpha", 2026)).resolves.toBe(
        "2026-1025",
      )
    })

    it("ignores custom numbers that do not match the auto-sequence shape", async () => {
      const { tx } = createFakeTx({
        count: 3,
        taken: ["F-2026-0001", "Henri-Q1", "2026-1028 "],
      })

      await expect(nextAutoNumber(tx, "user_alpha", 2026)).resolves.toBe(
        "2026-1028",
      )
    })

    it("crosses the digit-width boundary while skipping taken numbers", async () => {
      const { tx } = createFakeTx({
        count: 8974,
        taken: ["2026-9999", "2026-10000"],
      })

      await expect(nextAutoNumber(tx, "user_alpha", 2026)).resolves.toBe(
        "2026-10001",
      )
    })
  })

  describe("year handling", () => {
    it("only loads the numbers already taken for the requested year", async () => {
      const { tx, findManyWhere } = createFakeTx({ count: 0 })

      await nextAutoNumber(tx, "user_alpha", 2026)

      expect(findManyWhere).toEqual([
        { userId: "user_alpha", number: { startsWith: "2026-" } },
      ])
    })

    it("carries invoices from previous years into the new year sequence", async () => {
      const { tx } = createFakeTx({ count: 12, taken: [] })

      await expect(nextAutoNumber(tx, "user_alpha", 2027)).resolves.toBe(
        "2027-1037",
      )
    })

    it("does not skip a number taken in a different year", async () => {
      const { tx } = createFakeTx({ count: 0, taken: [] })

      await expect(nextAutoNumber(tx, "user_alpha", 2027)).resolves.toBe(
        "2027-1025",
      )
    })
  })

  describe("advisory lock", () => {
    it("acquires the advisory lock before reading existing numbers", async () => {
      const { tx, callOrder, lockKeys } = createFakeTx({ count: 0 })

      await nextAutoNumber(tx, "user_alpha", 2026)

      expect(callOrder[0]).toBe("lock")
      expect(lockKeys).toHaveLength(1)
    })

    it("derives a stable lock key from the user id", async () => {
      const first = createFakeTx({ count: 0 })
      const second = createFakeTx({ count: 4 })

      await nextAutoNumber(first.tx, "user_alpha", 2026)
      await nextAutoNumber(second.tx, "user_alpha", 2027)

      expect(first.lockKeys[0]).toBe(BigInt("465848188936467125"))
      expect(second.lockKeys[0]).toBe(BigInt("465848188936467125"))
    })

    it("derives a different lock key for a different user", async () => {
      const { tx, lockKeys } = createFakeTx({ count: 0 })

      await nextAutoNumber(tx, "user_beta", 2026)

      expect(lockKeys[0]).toBe(BigInt("205447223661396242"))
    })

    it("keeps the lock key inside the 60-bit range accepted by int8", async () => {
      const ids = ["user_alpha", "user_beta", "clx0000000000000000000000"]

      for (const id of ids) {
        const { tx, lockKeys } = createFakeTx({ count: 0 })
        await nextAutoNumber(tx, id, 2026)

        expect(lockKeys[0]).toBeGreaterThanOrEqual(BigInt("0"))
        expect(lockKeys[0]).toBeLessThan(BigInt("1152921504606846976"))
      }
    })
  })
})
