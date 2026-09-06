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
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "quotes")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function getRequest(qs = ""): Request {
  return new Request(`http://localhost/api/quotes${qs}`)
}

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/quotes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

interface QuoteListResponse {
  data: { id: string; number: string }[]
}

interface QuoteResponse {
  id: string
  number: string
}

function basePayload(clientId: string): Record<string, unknown> {
  return {
    clientId,
    issueDate: "2026-01-01",
    lines: [{ label: "Prestation", qty: 1, rate: 800 }],
  }
}

describe("GET /api/quotes (integration)", () => {
  it("never returns another user's quotes", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    await makeQuote(ctx.prisma, { userId: owner.id, clientId: ownerClient.id })

    const { GET } = await import("./route")
    const res = await GET(getRequest())
    const body = (await res.json()) as QuoteListResponse

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(0)
  })

  it("rejects an invalid status filter with 400, not 500", async () => {
    const { GET } = await import("./route")
    const res = await GET(getRequest("?status=NOT_A_STATUS"))

    expect(res.status).toBe(400)
  })
})

describe("POST /api/quotes (integration)", () => {
  it("allocates a D-YYYY-NNNN number", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })

    const { POST } = await import("./route")
    const res = await POST(postRequest(basePayload(client.id)))
    const body = (await res.json()) as QuoteResponse

    expect(res.status).toBe(201)
    expect(body.number).toMatch(/^D-\d{4}-\d{4}$/)
  })

  it("rejects an invalid payload (empty lines) with 400", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({ ...basePayload(client.id), lines: [] }),
    )

    expect(res.status).toBe(400)
  })

  it("rejects creating a quote for another user's client with 401, never 200", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })

    const { POST } = await import("./route")
    const res = await POST(postRequest(basePayload(ownerClient.id)))

    expect(res.status).toBe(401)
  })

  it("never assigns the same number to two concurrent creates for the same user", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })

    const { POST } = await import("./route")
    const concurrency = 8
    const responses = await Promise.all(
      Array.from({ length: concurrency }, () =>
        POST(postRequest(basePayload(client.id))),
      ),
    )

    expect(responses.every((r) => r.status === 201)).toBe(true)
    const bodies = (await Promise.all(
      responses.map((r) => r.json()),
    )) as QuoteResponse[]
    const numbers = new Set(bodies.map((b) => b.number))
    expect(numbers.size).toBe(concurrency)

    const stored = await ctx.prisma.quote.findMany({
      where: { userId: currentUser.id },
      select: { number: true },
    })
    expect(new Set(stored.map((q) => q.number)).size).toBe(concurrency)
  })
})
