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
import { makeClient, makeQuote, makeUser } from "@/test/integration/factories"
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

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "quote_id")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function getRequest(id: string): Request {
  return new Request(`http://localhost/api/quotes/${id}`)
}

function patchRequest(id: string, body: Record<string, unknown>): Request {
  return new Request(`http://localhost/api/quotes/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function deleteRequest(id: string): Request {
  return new Request(`http://localhost/api/quotes/${id}`, { method: "DELETE" })
}

function fullUpdatePayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    status: "SENT",
    issueDate: "2026-01-01",
    lines: [{ label: "Prestation", qty: 1, rate: 900 }],
    ...overrides,
  }
}

describe("GET /api/quotes/[id] (integration)", () => {
  it("returns 404 (never 200) for another user's quote", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const quote = await makeQuote(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest(quote.id), {
      params: Promise.resolve({ id: quote.id }),
    })

    expect(res.status).toBe(404)
  })
})

describe("PATCH /api/quotes/[id] (integration)", () => {
  it("rejects an invalid status with 400", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const quote = await makeQuote(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest(quote.id, fullUpdatePayload({ status: "NOT_A_STATUS" })),
      { params: Promise.resolve({ id: quote.id }) },
    )

    expect(res.status).toBe(400)
  })

  it("returns 404 (never 200) when patching another user's quote", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const quote = await makeQuote(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
      status: "DRAFT",
    })

    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest(quote.id, fullUpdatePayload({ status: "ACCEPTED" })),
      { params: Promise.resolve({ id: quote.id }) },
    )

    expect(res.status).toBe(404)

    const untouched = await ctx.prisma.quote.findUniqueOrThrow({
      where: { id: quote.id },
      select: { status: true },
    })
    expect(untouched.status).toBe("DRAFT")
  })
})

describe("DELETE /api/quotes/[id] (integration)", () => {
  it("deletes the caller's own quote", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const quote = await makeQuote(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(quote.id), {
      params: Promise.resolve({ id: quote.id }),
    })

    expect(res.status).toBe(200)
    const remaining = await ctx.prisma.quote.findUnique({
      where: { id: quote.id },
    })
    expect(remaining).toBeNull()
  })

  it("returns 404 (never 200) when deleting another user's quote", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const quote = await makeQuote(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
    })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(quote.id), {
      params: Promise.resolve({ id: quote.id }),
    })

    expect(res.status).toBe(404)
    const untouched = await ctx.prisma.quote.findUnique({
      where: { id: quote.id },
    })
    expect(untouched).not.toBeNull()
  })
})
