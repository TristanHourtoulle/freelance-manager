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
  makeClient,
  makeInvoiceWithClaimedLateFee,
  makeUser,
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

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "recap")
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
  return new Request(`http://localhost/api/clients/${id}/recap`)
}

describe("GET /api/clients/[id]/recap (integration)", () => {
  /**
   * The PDF body is a rendered binary stream (`@react-pdf/renderer`), and
   * this repo has no PDF-text-extraction dependency to assert the totals
   * embedded in it. What IS asserted here — a 200 with the right headers —
   * still proves something real: the route reads the invoice's FULL row
   * (an `include` with no top-level `select`, so `lateFeeFixed` /
   * `lateFeeInterest` / `lateFeeClaimedAt` / `lateFeeWaived` all come back
   * regardless) and feeds it straight into `getInvoiceComputed`, so a
   * claimed-but-unpaid penalty does not throw while rendering. Asserting
   * the actual `totalOutstanding`/`overdueCount` numbers baked into the PDF
   * would need a new parsing dependency, which is outside this ticket's
   * scope to add unilaterally — flagged rather than silently worked around.
   */
  it("renders 200 with a PDF content-type for a client with a claimed, unpaid penalty", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    await makeInvoiceWithClaimedLateFee(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest(client.id), {
      params: Promise.resolve({ id: client.id }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    const buffer = await res.arrayBuffer()
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it("returns 404 (never 200) for another user's client", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })

    const { GET } = await import("./route")
    const res = await GET(getRequest(ownerClient.id), {
      params: Promise.resolve({ id: ownerClient.id }),
    })

    expect(res.status).toBe(404)
  })
})
