import {
  afterAll,
  afterEach,
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

const { sendNotificationMock } = vi.hoisted(() => ({
  sendNotificationMock: vi.fn(),
}))
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: sendNotificationMock,
  },
}))

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "push_test")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
  sendNotificationMock.mockReset()
  vi.stubEnv("VAPID_SUBJECT", "mailto:test@example.test")
  vi.stubEnv("VAPID_PUBLIC_KEY", "test-public-key")
  vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function postRequest(): Request {
  return new Request("http://localhost/api/push/test", { method: "POST" })
}

describe("POST /api/push/test (integration)", () => {
  it("returns 401 for an unauthenticated caller", async () => {
    currentUser = null as unknown as ApiUser
    const { POST } = await import("./route")
    const res = await POST(postRequest())

    expect(res.status).toBe(401)
    expect(sendNotificationMock).not.toHaveBeenCalled()
  })

  it("never reaches the real web-push network: delivery goes through the mocked SDK boundary only", async () => {
    sendNotificationMock.mockResolvedValue(undefined)
    await makePushSubscription(ctx.prisma, { userId: currentUser.id })

    const { POST } = await import("./route")
    await POST(postRequest())

    expect(sendNotificationMock).toHaveBeenCalledTimes(1)
    const [subscriptionArg] = sendNotificationMock.mock.calls[0] ?? []
    expect(subscriptionArg).toMatchObject({
      endpoint: expect.stringContaining("push.example.test"),
    })
  })

  it("delivers to the caller's own subscription only and stamps lastDeliveredAt", async () => {
    sendNotificationMock.mockResolvedValue(undefined)
    const mine = await makePushSubscription(ctx.prisma, {
      userId: currentUser.id,
    })
    const other = await makeUser(ctx.prisma)
    await makePushSubscription(ctx.prisma, { userId: other.id })

    const { POST } = await import("./route")
    const res = await POST(postRequest())
    const body = (await res.json()) as { sent: number; pruned: number }

    expect(res.status).toBe(200)
    expect(body.sent).toBe(1)
    expect(sendNotificationMock).toHaveBeenCalledTimes(1)

    const updated = await ctx.prisma.pushSubscription.findUniqueOrThrow({
      where: { id: mine.id },
    })
    expect(updated.lastDeliveredAt).not.toBeNull()
    expect(updated.failureCount).toBe(0)
  })

  it("prunes a subscription the push service reports as gone (410)", async () => {
    sendNotificationMock.mockRejectedValue(
      Object.assign(new Error("Gone"), { statusCode: 410 }),
    )
    const mine = await makePushSubscription(ctx.prisma, {
      userId: currentUser.id,
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest())
    const body = (await res.json()) as { sent: number; pruned: number }

    expect(res.status).toBe(200)
    expect(body.sent).toBe(0)
    expect(body.pruned).toBe(1)

    const gone = await ctx.prisma.pushSubscription.findUnique({
      where: { id: mine.id },
    })
    expect(gone).toBeNull()
  })

  it("records a transient delivery failure instead of pruning", async () => {
    sendNotificationMock.mockRejectedValue(
      Object.assign(new Error("Service unavailable"), { statusCode: 503 }),
    )
    const mine = await makePushSubscription(ctx.prisma, {
      userId: currentUser.id,
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest())
    const body = (await res.json()) as { sent: number; pruned: number }

    expect(res.status).toBe(200)
    expect(body.sent).toBe(0)
    expect(body.pruned).toBe(0)

    const updated = await ctx.prisma.pushSubscription.findUniqueOrThrow({
      where: { id: mine.id },
    })
    expect(updated.failureCount).toBe(1)
    expect(updated.lastFailureAt).not.toBeNull()
  })

  it("skips delivery entirely when VAPID keys are not configured", async () => {
    vi.stubEnv("VAPID_SUBJECT", "")
    vi.stubEnv("VAPID_PUBLIC_KEY", "")
    vi.stubEnv("VAPID_PRIVATE_KEY", "")
    await makePushSubscription(ctx.prisma, { userId: currentUser.id })

    const { POST } = await import("./route")
    const res = await POST(postRequest())
    const body = (await res.json()) as { sent: number; pruned: number }

    expect(res.status).toBe(200)
    expect(body).toEqual({ sent: 0, pruned: 0 })
    expect(sendNotificationMock).not.toHaveBeenCalled()
  })
})
