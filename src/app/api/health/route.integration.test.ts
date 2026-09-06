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

let ctx: IsolatedSchema
let queryRawOverride: (() => Promise<never>) | null = null

vi.mock("@/lib/db", () => ({
  get prisma() {
    if (queryRawOverride) return { $queryRaw: queryRawOverride }
    return ctx.prisma
  },
}))

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "health")
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
})

afterEach(() => {
  vi.unstubAllEnvs()
  queryRawOverride = null
})

function getRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/health", { headers })
}

interface DetailedHealthResponse {
  ok: boolean
  status: string
  checks: { database: string }
  uptime: number
  timestamp: string
  version: string
}

describe("GET /api/health (integration)", () => {
  it("is reachable with no session and no key: 200 with only { ok: true }", async () => {
    vi.stubEnv("HEALTH_KEY", "super-secret-health-key")

    const { GET } = await import("./route")
    const res = await GET(getRequest())
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
  })

  it("never leaks uptime/version/db-detail to an anonymous or wrong-key caller", async () => {
    vi.stubEnv("HEALTH_KEY", "super-secret-health-key")

    const { GET } = await import("./route")
    const wrongKeyRes = await GET(
      getRequest({ "x-health-key": "not-the-right-key" }),
    )
    const wrongKeyBody = await wrongKeyRes.text()

    expect(wrongKeyRes.status).toBe(200)
    expect(JSON.parse(wrongKeyBody)).toEqual({ ok: true })
    expect(wrongKeyBody).not.toContain("uptime")
    expect(wrongKeyBody).not.toContain("version")
    expect(wrongKeyBody).not.toContain("checks")
  })

  it("returns the detailed payload only with a valid X-Health-Key", async () => {
    vi.stubEnv("HEALTH_KEY", "super-secret-health-key")

    const { GET } = await import("./route")
    const res = await GET(
      getRequest({ "x-health-key": "super-secret-health-key" }),
    )
    const body = (await res.json()) as DetailedHealthResponse

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.status).toBe("healthy")
    expect(body.checks.database).toBe("connected")
    expect(typeof body.uptime).toBe("number")
  })

  it("treats every caller as anonymous when HEALTH_KEY is unset", async () => {
    vi.stubEnv("HEALTH_KEY", "")

    const { GET } = await import("./route")
    const res = await GET(getRequest({ "x-health-key": "anything" }))
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
  })

  it("reports 503 and ok:false when the database is unreachable, even to an anonymous caller", async () => {
    vi.stubEnv("HEALTH_KEY", "super-secret-health-key")
    queryRawOverride = () => Promise.reject(new Error("connection terminated"))

    const { GET } = await import("./route")
    const res = await GET(getRequest())
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(503)
    expect(body).toEqual({ ok: false })
  })

  it("reports 503 with unhealthy detail for a valid key when the database is down", async () => {
    vi.stubEnv("HEALTH_KEY", "super-secret-health-key")
    queryRawOverride = () => Promise.reject(new Error("connection terminated"))

    const { GET } = await import("./route")
    const res = await GET(
      getRequest({ "x-health-key": "super-secret-health-key" }),
    )
    const body = (await res.json()) as DetailedHealthResponse

    expect(res.status).toBe(503)
    expect(body.ok).toBe(false)
    expect(body.status).toBe("unhealthy")
    expect(body.checks.database).toBe("disconnected")
  })
})
