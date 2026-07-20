import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    pushSubscription: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

const getAuthUser = vi.fn()
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getAuthUser: () => getAuthUser() }
})

const ORIGIN = "http://localhost:3000"
const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL
process.env.NEXT_PUBLIC_APP_URL = ORIGIN

const SUBSCRIPTION = {
  endpoint: "https://push.example.com/abc123",
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
}

function request(
  method: string,
  body: unknown,
  origin: string | null = ORIGIN,
) {
  return new Request("http://localhost:3000/api/push/subscribe", {
    method,
    headers: {
      "content-type": "application/json",
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(body),
  })
}

afterAll(() => {
  if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl
})

describe("/api/push/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.pushSubscription.upsert.mockResolvedValue({ id: "sub-1" })
    prismaMock.pushSubscription.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.pushSubscription.findFirst.mockResolvedValue(null)
  })

  it("rejects an unauthenticated POST", async () => {
    getAuthUser.mockResolvedValue(null)
    const { POST } = await import("./route")
    const res = await POST(request("POST", SUBSCRIPTION))

    expect(res.status).toBe(401)
    expect(prismaMock.pushSubscription.upsert).not.toHaveBeenCalled()
  })

  it("rejects a cross-origin POST", async () => {
    const { POST } = await import("./route")
    const res = await POST(request("POST", SUBSCRIPTION, "https://evil.test"))

    expect(res.status).toBe(403)
    expect(prismaMock.pushSubscription.upsert).not.toHaveBeenCalled()
  })

  it("upserts the subscription scoped to the session user", async () => {
    const { POST } = await import("./route")
    const res = await POST(request("POST", SUBSCRIPTION))

    expect(res.status).toBe(201)
    const [arg] = prismaMock.pushSubscription.upsert.mock.calls[0] ?? []
    expect(arg.where).toEqual({ endpoint: SUBSCRIPTION.endpoint })
    expect(arg.create.userId).toBe("user-1")
    expect(arg.update.userId).toBe("user-1")
  })

  it("rejects a malformed subscription body", async () => {
    const { POST } = await import("./route")
    const res = await POST(request("POST", { endpoint: "not-a-url" }))

    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(prismaMock.pushSubscription.upsert).not.toHaveBeenCalled()
  })

  it("scopes DELETE by userId, never by endpoint alone", async () => {
    const { DELETE } = await import("./route")
    const res = await DELETE(
      request("DELETE", { endpoint: SUBSCRIPTION.endpoint }),
    )

    expect(res.status).toBe(200)
    const [arg] = prismaMock.pushSubscription.deleteMany.mock.calls[0] ?? []
    expect(arg.where).toEqual({
      userId: "user-1",
      endpoint: SUBSCRIPTION.endpoint,
    })
  })

  it("reports configuration and subscription state on GET", async () => {
    prismaMock.pushSubscription.findFirst.mockResolvedValue({
      lastDeliveredAt: new Date("2026-07-19T06:00:00.000Z"),
    })

    const { GET } = await import("./route")
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.subscribed).toBe(true)
    expect(body.lastDeliveredAt).toBe("2026-07-19T06:00:00.000Z")
    expect(typeof body.configured).toBe("boolean")
  })
})
