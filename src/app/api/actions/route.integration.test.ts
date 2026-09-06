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
  makeAction,
  makeClient,
  makeInvoice,
  makeMeeting,
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
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "actions")
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
  return new Request(`http://localhost/api/actions${qs}`)
}

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

interface ActionListResponse {
  data: { id: string; clientId: string | null }[]
}

describe("GET /api/actions (integration)", () => {
  it("returns 401 for an unauthenticated caller", async () => {
    currentUser = null as unknown as ApiUser
    const { GET } = await import("./route")
    const res = await GET(getRequest())

    expect(res.status).toBe(401)
  })

  it("never returns another user's actions", async () => {
    const other = await makeUser(ctx.prisma)
    await makeAction(ctx.prisma, { userId: other.id })
    const mine = await makeAction(ctx.prisma, { userId: currentUser.id })

    const { GET } = await import("./route")
    const res = await GET(getRequest())
    const body = (await res.json()) as ActionListResponse

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]?.id).toBe(mine.id)
  })

  it("returns only unclassified actions for clientId=none", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    await makeAction(ctx.prisma, { userId: currentUser.id, clientId: client.id })
    const unassigned = await makeAction(ctx.prisma, {
      userId: currentUser.id,
      clientId: null,
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest("?clientId=none"))
    const body = (await res.json()) as ActionListResponse

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]?.id).toBe(unassigned.id)
  })
})

describe("POST /api/actions (integration)", () => {
  it("creates an unclassified action scoped to the session user", async () => {
    const { POST } = await import("./route")
    const res = await POST(postRequest({ title: "Appeler le client" }))
    const body = (await res.json()) as { id: string }

    expect(res.status).toBe(201)
    const created = await ctx.prisma.clientAction.findUniqueOrThrow({
      where: { id: body.id },
    })
    expect(created.userId).toBe(currentUser.id)
    expect(created.clientId).toBeNull()
  })

  it("returns 404 (never 201) when the client belongs to another user", async () => {
    const other = await makeUser(ctx.prisma)
    const otherClient = await makeClient(ctx.prisma, { userId: other.id })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({ title: "Hijack", clientId: otherClient.id }),
    )

    expect(res.status).toBe(404)
    const count = await ctx.prisma.clientAction.count()
    expect(count).toBe(0)
  })

  it("rejects linking an invoice without a client with 400", async () => {
    const invoiceOwner = await makeClient(ctx.prisma, {
      userId: currentUser.id,
    })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: invoiceOwner.id,
    })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({ title: "Relance", invoiceId: invoice.id }),
    )

    expect(res.status).toBe(400)
  })

  it("returns 404 when the linked meeting belongs to another client", async () => {
    const clientA = await makeClient(ctx.prisma, { userId: currentUser.id })
    const clientB = await makeClient(ctx.prisma, { userId: currentUser.id })
    const meeting = await makeMeeting(ctx.prisma, {
      userId: currentUser.id,
      clientId: clientA.id,
    })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({
        title: "Suivi réunion",
        clientId: clientB.id,
        meetingId: meeting.id,
      }),
    )

    expect(res.status).toBe(404)
  })
})
