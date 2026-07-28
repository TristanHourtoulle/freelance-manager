import { describe, expect, it, vi } from "vitest"
import { z } from "zod/v4"

vi.mock("@/lib/db", () => ({ prisma: {} }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))

import {
  fetchAllInputSchema,
  FETCH_ALL_SAFETY_CAP,
  paginatedOutputSchema,
  runPaginatedQuery,
} from "./common"

interface Row {
  id: string
  value: number
}

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${String(i).padStart(4, "0")}`,
    value: i,
  }))
}

function makePageFn(rows: Row[]) {
  return vi.fn(async ({ cursor, take }: { cursor?: string; take: number }) => {
    const startIndex = cursor ? rows.findIndex((r) => r.id === cursor) + 1 : 0
    return rows.slice(startIndex, startIndex + take)
  })
}

describe("runPaginatedQuery — total", () => {
  it("reports the real DB count as total, independent of page size", async () => {
    const rows = makeRows(194)
    const page = makePageFn(rows)
    const count = vi.fn().mockResolvedValue(194)

    const result = await runPaginatedQuery({
      args: { limit: 25 },
      count,
      page,
    })

    expect(result.total).toBe(194)
    expect(result.data).toHaveLength(25)
    expect(count).toHaveBeenCalledTimes(1)
  })

  it("calls count exactly once even when fetchAll walks many pages", async () => {
    const rows = makeRows(120)
    const page = makePageFn(rows)
    const count = vi.fn().mockResolvedValue(120)

    await runPaginatedQuery({
      args: { limit: 10, fetchAll: true },
      count,
      page,
      safetyCap: 1000,
    })

    expect(count).toHaveBeenCalledTimes(1)
  })

  it("never derives total from the number of rows returned", async () => {
    const rows = makeRows(3)
    const page = makePageFn(rows)
    const count = vi.fn().mockResolvedValue(194)

    const result = await runPaginatedQuery({
      args: { limit: 25 },
      count,
      page,
    })

    expect(result.data).toHaveLength(3)
    expect(result.total).toBe(194)
  })
})

describe("runPaginatedQuery — cursor round-trip", () => {
  it("continues exactly where the previous page stopped, no dup, no gap", async () => {
    const rows = makeRows(60)
    const page = makePageFn(rows)
    const count = vi.fn().mockResolvedValue(60)

    const page1 = await runPaginatedQuery({ args: { limit: 25 }, count, page })
    expect(page1.data.map((r) => r.id)).toEqual(
      rows.slice(0, 25).map((r) => r.id),
    )
    expect(page1.hasMore).toBe(true)
    expect(page1.nextCursor).toBe("row-0024")

    const page2 = await runPaginatedQuery({
      args: { limit: 25, cursor: page1.nextCursor ?? undefined },
      count,
      page,
    })
    expect(page2.data.map((r) => r.id)).toEqual(
      rows.slice(25, 50).map((r) => r.id),
    )
    expect(page2.hasMore).toBe(true)

    const page3 = await runPaginatedQuery({
      args: { limit: 25, cursor: page2.nextCursor ?? undefined },
      count,
      page,
    })
    expect(page3.data.map((r) => r.id)).toEqual(
      rows.slice(50, 60).map((r) => r.id),
    )
    expect(page3.hasMore).toBe(false)
    expect(page3.nextCursor).toBeNull()

    const seen = [...page1.data, ...page2.data, ...page3.data].map((r) => r.id)
    expect(seen).toEqual(rows.map((r) => r.id))
    expect(new Set(seen).size).toBe(60)
  })

  it("requests limit+1 rows so hasMore never needs a second query", async () => {
    const rows = makeRows(5)
    const page = makePageFn(rows)
    const count = vi.fn().mockResolvedValue(5)

    await runPaginatedQuery({ args: { limit: 3 }, count, page })

    expect(page).toHaveBeenCalledWith({ cursor: undefined, take: 4 })
  })
})

describe("runPaginatedQuery — fetchAll auto-follow", () => {
  it("stops at the safety cap and reports truncated with a resumable cursor", async () => {
    const rows = makeRows(120)
    const page = makePageFn(rows)
    const count = vi.fn().mockResolvedValue(120)

    const result = await runPaginatedQuery({
      args: { limit: 10, fetchAll: true },
      count,
      page,
      safetyCap: 50,
    })

    expect(result.data).toHaveLength(50)
    expect(result.truncated).toBe(true)
    expect(result.hasMore).toBe(true)
    expect(result.total).toBe(120)
    expect(result.nextCursor).toBe(rows[49]!.id)
  })

  it("never reports truncated when the walk naturally exhausts the set", async () => {
    const rows = makeRows(37)
    const page = makePageFn(rows)
    const count = vi.fn().mockResolvedValue(37)

    const result = await runPaginatedQuery({
      args: { limit: 10, fetchAll: true },
      count,
      page,
      safetyCap: 1000,
    })

    expect(result.data).toHaveLength(37)
    expect(result.data.map((r) => r.id)).toEqual(rows.map((r) => r.id))
    expect(result.truncated).toBe(false)
    expect(result.hasMore).toBe(false)
    expect(result.nextCursor).toBeNull()
    expect(result.total).toBe(37)
    expect(page).toHaveBeenCalledTimes(4)
  })

  it("does not mark truncated when the last page lands exactly on the cap", async () => {
    const rows = makeRows(50)
    const page = makePageFn(rows)
    const count = vi.fn().mockResolvedValue(50)

    const result = await runPaginatedQuery({
      args: { limit: 10, fetchAll: true },
      count,
      page,
      safetyCap: 50,
    })

    expect(result.data).toHaveLength(50)
    expect(result.truncated).toBe(false)
    expect(result.hasMore).toBe(false)
    expect(result.nextCursor).toBeNull()
  })

  it("defaults the safety cap to FETCH_ALL_SAFETY_CAP", async () => {
    const rows = makeRows(5)
    const page = makePageFn(rows)
    const count = vi.fn().mockResolvedValue(5)

    const result = await runPaginatedQuery({
      args: { limit: 2, fetchAll: true },
      count,
      page,
    })

    expect(result.truncated).toBe(false)
    expect(result.data).toHaveLength(5)
    expect(FETCH_ALL_SAFETY_CAP).toBeGreaterThan(5)
  })
})

describe("paginatedOutputSchema", () => {
  const schema = paginatedOutputSchema(z.object({ id: z.string() }))

  it("accepts a full v2 payload", () => {
    const result = schema.safeParse({
      data: [{ id: "a" }],
      nextCursor: null,
      hasMore: false,
      total: 194,
      truncated: false,
    })
    expect(result.success).toBe(true)
  })

  it("rejects a payload missing the uncapped total", () => {
    const result = schema.safeParse({
      data: [],
      nextCursor: null,
      hasMore: false,
      truncated: false,
    })
    expect(result.success).toBe(false)
  })

  it("rejects a payload missing truncated", () => {
    const result = schema.safeParse({
      data: [],
      nextCursor: null,
      hasMore: false,
      total: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe("fetchAllInputSchema", () => {
  it("defaults to false when omitted", () => {
    expect(fetchAllInputSchema.parse(undefined)).toBe(false)
  })

  it("accepts an explicit true", () => {
    expect(fetchAllInputSchema.parse(true)).toBe(true)
  })
})
