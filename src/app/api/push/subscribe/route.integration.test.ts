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
import { makePushSubscription, makeUser } from "@/test/integration/factories"
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
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "push_sub")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

const SUBSCRIPTION = {
  endpoint: "https://push.example.test/abc123",
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
}

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function deleteRequest(body: unknown): Request {
  return new Request("http://localhost/api/push/subscribe", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

interface SubscribeGetResponse {
  configured: boolean
  subscribed: boolean
  lastDeliveredAt: string | null
}

describe("GET /api/push/subscribe (integration)", () => {
  it("returns 401 for an unauthenticated caller", async () => {
    currentUser = null as unknown as ApiUser
    const { GET } = await import("./route")
    const res = await GET()

    expect(res.status).toBe(401)
  })

  it("reports subscribed:false with no subscriptions", async () => {
    const { GET } = await import("./route")
    const res = await GET()
    const body = (await res.json()) as SubscribeGetResponse

    expect(res.status).toBe(200)
    expect(body.subscribed).toBe(false)
    expect(body.lastDeliveredAt).toBeNull()
  })

  it("reports the caller's own subscription, never another user's", async () => {
    const other = await makeUser(ctx.prisma)
    await makePushSubscription(ctx.prisma, {
      userId: other.id,
      lastDeliveredAt: new Date(),
    })

    const { GET } = await import("./route")
    const res = await GET()
    const body = (await res.json()) as SubscribeGetResponse

    expect(res.status).toBe(200)
    expect(body.subscribed).toBe(false)
  })
})

describe("POST /api/push/subscribe (integration)", () => {
  it("upserts a subscription owned by the session user", async () => {
    const { POST } = await import("./route")
    const res = await POST(postRequest(SUBSCRIPTION))

    expect(res.status).toBe(201)
    const row = await ctx.prisma.pushSubscription.findUniqueOrThrow({
      where: { endpoint: SUBSCRIPTION.endpoint },
    })
    expect(row.userId).toBe(currentUser.id)
    expect(row.p256dh).toBe(SUBSCRIPTION.keys.p256dh)
  })

  it("re-subscribing the same endpoint reassigns ownership instead of duplicating", async () => {
    const other = await makeUser(ctx.prisma)
    await makePushSubscription(ctx.prisma, {
      userId: other.id,
      endpoint: SUBSCRIPTION.endpoint,
      failureCount: 3,
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest(SUBSCRIPTION))
    expect(res.status).toBe(201)

    const rows = await ctx.prisma.pushSubscription.findMany({
      where: { endpoint: SUBSCRIPTION.endpoint },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.userId).toBe(currentUser.id)
    expect(rows[0]?.failureCount).toBe(0)
  })

  it("rejects a malformed endpoint with 400", async () => {
    const { POST } = await import("./route")
    const res = await POST(
      postRequest({ endpoint: "not-a-url", keys: SUBSCRIPTION.keys }),
    )

    expect(res.status).toBe(400)
    const count = await ctx.prisma.pushSubscription.count()
    expect(count).toBe(0)
  })
})

describe("DELETE /api/push/subscribe (integration)", () => {
  it("scopes deletion by userId, never by endpoint alone", async () => {
    const other = await makeUser(ctx.prisma)
    const theirs = await makePushSubscription(ctx.prisma, { userId: other.id })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest({ endpoint: theirs.endpoint }))
    const body = (await res.json()) as { deleted: number }

    expect(res.status).toBe(200)
    expect(body.deleted).toBe(0)
    const stillThere = await ctx.prisma.pushSubscription.findUnique({
      where: { id: theirs.id },
    })
    expect(stillThere).not.toBeNull()
  })

  it("deletes the caller's own subscription", async () => {
    const mine = await makePushSubscription(ctx.prisma, {
      userId: currentUser.id,
    })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest({ endpoint: mine.endpoint }))
    const body = (await res.json()) as { deleted: number }

    expect(res.status).toBe(200)
    expect(body.deleted).toBe(1)
    const gone = await ctx.prisma.pushSubscription.findUnique({
      where: { id: mine.id },
    })
    expect(gone).toBeNull()
  })
})
